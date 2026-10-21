// Package dashboard is a Go and HTMX admin shell: sidebar, data table,
// custom select, image upload, and an activity old/new viewer.
// Mount Handler at a URL prefix and render the shell or dataTable templates.
package dashboard

import (
	"embed"
	"encoding/json"
	"html"
	"html/template"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

//go:embed templates/*.html
var templateFiles embed.FS

//go:embed static/dashboard.css static/dashboard.js
var staticFiles embed.FS

// Page is the sidebar shell. Leave Admin empty to render the login card.
type Page struct {
	Locale, Dir, CSRF, Title, AppName, Version string
	Admin, Brand, BrandSub, LogoURL, Home      string
	Heading, Flash, LoginLead, LogoutLabel     string
	LogoutAction, LocaleBase, AssetPrefix      string
	HTMX                                       string
	Nav                                        []NavItem
	Switch, ProfileExtra, Body                 template.HTML
}

// NavItem is one sidebar link. Icon is inline SVG.
type NavItem struct {
	Href, Label string
	Icon        template.HTML
	Active      bool
}

// Option is one choice in a select or table filter.
type Option struct {
	Value, Label string
}

// Select is the custom select field rendered by the selectField template.
type Select struct {
	Name, Label, Value, Placeholder string
	Required, Submit                bool
	Options                         []Option
	Attr                            template.HTMLAttr
}

// Image is one file already stored for an upload field.
type Image struct {
	Key, URL string
}

// Upload is the image field rendered by the imageField template.
type Upload struct {
	Name, Prompt, Browse, Remove string
	Multiple                     bool
	Existing                     []Image
}

// Column is one data-table column. Locked columns stay visible.
type Column struct {
	Key, Label string
	Locked     bool
}

// Filter is a select that filters rows by a cell's data-value.
type Filter struct {
	Key, Label string
	Options    []Option
}

// Bulk is the hidden form shown when rows are checked.
type Bulk struct {
	Action, Label, Confirm string
}

// Cell is one table cell. HTML is rendered; Text is used for search.
type Cell struct {
	Key, Text, Filter, Sort string
	HTML                    template.HTML
}

// Row is one table row.
type Row struct {
	ID, Search string
	Cells      []Cell
	Actions    template.HTML
}

// Table is rendered by the dataTable template.
type Table struct {
	ID, CSRF, SearchLabel, ColumnsLabel, AllLabel, Empty, CreateHref, CreateLabel string
	SelectAll, Showing, Of, Selected, PageLabel, Prev, Next                       string
	Columns                                                                       []Column
	Filters                                                                       []Filter
	Bulk                                                                          *Bulk
	Rows                                                                          []Row
	HasActions                                                                    bool
}

// Text holds the labels New uses for an English or Arabic table.
type Text struct {
	Search, Columns, All, Empty, Create, SelectAll string
	Showing, Of, Selected, Rows, Prev, Next        string
}

// ChangeText holds the labels for an old/new activity cell.
type ChangeText struct {
	Title, Close, View, Old, New string
}

// Link is a clickable label, used for a record or the store it belongs to.
type Link struct {
	Text, Href string
}

// Handler serves dashboard.css and dashboard.js. Mount it under the same
// prefix passed as Page.AssetPrefix, for example /static.
func Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, "/")
		var contentType string
		switch name {
		case "dashboard.css":
			contentType = "text/css; charset=utf-8"
		case "dashboard.js":
			contentType = "text/javascript; charset=utf-8"
		default:
			http.NotFound(w, r)
			return
		}
		body, err := staticFiles.ReadFile("static/" + name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", contentType)
		_, _ = w.Write(body)
	})
}

// Templates returns the shell, dataTable, selectField, imageField, and lang templates.
func Templates() *template.Template {
	t, err := NewTemplates(nil)
	if err != nil {
		panic(err)
	}
	return t
}

// NewTemplates parses the embedded templates with extra functions merged in.
// Add functions before parsing any templates of your own that call them:
//
//	t, err := dashboard.NewTemplates(template.FuncMap{"money": formatMoney})
func NewTemplates(extra template.FuncMap) (*template.Template, error) {
	funcs := FuncMap()
	for name, fn := range extra {
		funcs[name] = fn
	}
	return template.New("dashboard").Funcs(funcs).ParseFS(templateFiles, "templates/*.html")
}

// FuncMap is the functions the embedded templates call.
func FuncMap() template.FuncMap {
	return template.FuncMap{
		"sel": func(name, label, value, placeholder string, required, submit bool, options []Option) Select {
			return Select{Name: name, Label: label, Value: value, Placeholder: placeholder, Required: required, Submit: submit, Options: options}
		},
		"mark": func(field Select, attr string) Select {
			field.Attr = template.HTMLAttr(attr)
			return field
		},
		"leadOption": func(label string, options []Option) []Option {
			return append([]Option{{Label: label}}, options...)
		},
		"pageSizes": func() []Option {
			return []Option{{Value: "10", Label: "10"}, {Value: "25", Label: "25"}, {Value: "50", Label: "50"}}
		},
		"initial": initial,
	}
}

// New builds an empty table with the given labels.
func New(id string, text Text) Table {
	return Table{
		ID: id, SearchLabel: text.Search, ColumnsLabel: text.Columns, AllLabel: text.All,
		Empty: text.Empty, CreateLabel: text.Create, SelectAll: text.SelectAll,
		Showing: text.Showing, Of: text.Of, Selected: text.Selected, PageLabel: text.Rows,
		Prev: text.Prev, Next: text.Next,
	}
}

// AddFilter adds a select for the distinct values already stored on this column.
func (t *Table) AddFilter(rows []Row, key, label string, names map[string]string) {
	seen := []string{}
	have := map[string]bool{}
	for _, row := range rows {
		for _, cell := range row.Cells {
			if cell.Key == key && cell.Filter != "" && !have[cell.Filter] {
				have[cell.Filter] = true
				seen = append(seen, cell.Filter)
			}
		}
	}
	if len(seen) < 2 {
		return
	}
	opts := make([]Option, len(seen))
	for i, value := range seen {
		name := names[value]
		if name == "" {
			name = value
		}
		opts[i] = Option{Value: value, Label: name}
	}
	t.Filters = append(t.Filters, Filter{Key: key, Label: label, Options: opts})
}

// Plain returns a text cell.
func Plain(key, text string) Cell {
	return Cell{Key: key, Text: text, Filter: text, Sort: text, HTML: template.HTML(html.EscapeString(text))}
}

// Rich returns a cell whose HTML is already trusted.
func Rich(key, text, filter, sort string, body template.HTML) Cell {
	return Cell{Key: key, Text: text, Filter: filter, Sort: sort, HTML: body}
}

// Chip returns a status chip. Class is escaped and appended to "chip".
func Chip(class, label string) template.HTML {
	return template.HTML(`<span class="chip ` + html.EscapeString(class) + `">` + html.EscapeString(label) + `</span>`)
}

// Anchor returns an escaped link.
func Anchor(href, label string) template.HTML {
	return template.HTML(`<a href="` + html.EscapeString(href) + `">` + html.EscapeString(label) + `</a>`)
}

// DeleteForm returns a POST form with a confirm dialog.
func DeleteForm(action, csrf, label, confirm string) template.HTML {
	return template.HTML(`<form method="post" action="` + html.EscapeString(action) + `" hx-confirm="` + html.EscapeString(confirm) + `"><input type="hidden" name="csrf" value="` + html.EscapeString(csrf) + `"><button class="btn ghost danger" type="submit">` + html.EscapeString(label) + `</button></form>`)
}

// MakeRow joins cell text into the search string.
func MakeRow(id string, cells []Cell, actions template.HTML) Row {
	parts := make([]string, len(cells))
	for i, cell := range cells {
		parts[i] = cell.Text
	}
	return Row{ID: id, Search: strings.ToLower(strings.Join(parts, " ")), Cells: cells, Actions: actions}
}

// Changes renders a View control. Hover shows old and new values, and a click opens them in a dialog.
// raw is JSON shaped as {"old":{...},"new":{...}}. An empty value renders an em dash.
func Changes(key string, text ChangeText, raw *string) Cell {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return Plain(key, "—")
	}
	oldLines, newLines := changeSides(raw)
	search := strings.Join(append(append([]string{}, oldLines...), newLines...), " ")
	var body strings.Builder
	body.WriteString(`<span class="activity-tip" data-activity-tip>`)
	body.WriteString(`<button type="button" class="activity-tip-label" data-activity-open data-title="`)
	body.WriteString(html.EscapeString(text.Title))
	body.WriteString(`" data-close="`)
	body.WriteString(html.EscapeString(text.Close))
	body.WriteString(`">`)
	body.WriteString(html.EscapeString(text.View))
	body.WriteString(`</button><span class="activity-tip-card" role="tooltip">`)
	writeChangeSide(&body, text.Old, oldLines)
	writeChangeSide(&body, text.New, newLines)
	body.WriteString(`</span></span>`)
	return Rich(key, search, "", search, template.HTML(body.String()))
}

// Record renders a label, optional link, and the stores it belongs to.
// storeLabel is the word shown before the store names, such as "Store".
func Record(key, storeLabel string, item Link, stores []Link) Cell {
	if item.Text == "" {
		item.Text = "—"
	}
	search := item.Text
	for _, store := range stores {
		search += " " + store.Text
	}
	if item.Href == "" && len(stores) == 0 {
		return Plain(key, item.Text)
	}
	var body strings.Builder
	if item.Href == "" {
		body.WriteString(html.EscapeString(item.Text))
	} else {
		body.WriteString(string(Anchor(item.Href, item.Text)))
	}
	if len(stores) > 0 {
		body.WriteString(`<span class="activity-store">`)
		body.WriteString(html.EscapeString(storeLabel))
		body.WriteString(" ")
		for i, store := range stores {
			if i > 0 {
				body.WriteString(", ")
			}
			if store.Href == "" {
				body.WriteString(html.EscapeString(store.Text))
			} else {
				body.WriteString(string(Anchor(store.Href, store.Text)))
			}
		}
		body.WriteString(`</span>`)
	}
	return Rich(key, search, item.Text, item.Text, template.HTML(body.String()))
}

func writeChangeSide(body *strings.Builder, title string, lines []string) {
	body.WriteString(`<span class="activity-tip-side"><strong>`)
	body.WriteString(html.EscapeString(title))
	body.WriteString(`</strong>`)
	if len(lines) == 0 {
		body.WriteString(`<span>—</span>`)
	}
	for _, line := range lines {
		body.WriteString(`<span>`)
		body.WriteString(html.EscapeString(line))
		body.WriteString(`</span>`)
	}
	body.WriteString(`</span>`)
}

func changeSides(raw *string) (oldLines, newLines []string) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	var payload struct {
		Old map[string]any `json:"old"`
		New map[string]any `json:"new"`
	}
	if err := json.Unmarshal([]byte(*raw), &payload); err != nil {
		return []string{*raw}, nil
	}
	return changeLines(payload.Old), changeLines(payload.New)
}

func changeLines(values map[string]any) []string {
	if len(values) == 0 {
		return nil
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	lines := make([]string, 0, len(keys))
	for _, key := range keys {
		lines = append(lines, key+": "+formatChangeValue(values[key]))
	}
	return lines
}

func formatChangeValue(v any) string {
	if v == nil {
		return "—"
	}
	switch value := v.(type) {
	case string:
		if value == "" {
			return "—"
		}
		return value
	case bool:
		if value {
			return "true"
		}
		return "false"
	case float64:
		if value == math.Trunc(value) && !math.IsInf(value, 0) {
			return strconv.FormatInt(int64(value), 10)
		}
		return strconv.FormatFloat(value, 'f', -1, 64)
	case []any, map[string]any:
		raw, err := json.Marshal(value)
		if err != nil {
			return ""
		}
		return string(raw)
	default:
		return ""
	}
}

func initial(name string) string {
	for _, r := range strings.TrimSpace(name) {
		return string(unicode.ToUpper(r))
	}
	return "?"
}
