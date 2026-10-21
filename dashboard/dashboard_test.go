package dashboard

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTableRecordAndChanges(t *testing.T) {
	raw := `{"old":{"name":"Clippers"},"new":{"name":"Oils"}}`
	table := New("activity", Text{
		Search: "Search", Columns: "Columns", All: "All", Empty: "None",
		Showing: "Showing", Of: "of", Selected: "selected", Rows: "Rows",
		Prev: "Previous", Next: "Next", SelectAll: "Select all",
	})
	table.Columns = []Column{
		{Key: "name", Label: "Name", Locked: true},
		{Key: "changes", Label: "Properties"},
	}
	table.Rows = append(table.Rows, MakeRow("1", []Cell{
		Record("name", "Store", Link{Text: "Oils", Href: "/categories/oils"}, []Link{{Text: "Black Brand", Href: "/stores/1"}}),
		Changes("changes", ChangeText{Title: "Properties", Close: "Close", View: "View", Old: "Old", New: "New"}, &raw),
	}, ""))

	var buf bytes.Buffer
	if err := Templates().ExecuteTemplate(&buf, "dataTable", table); err != nil {
		t.Fatal(err)
	}
	page := buf.String()
	for _, want := range []string{
		`data-datatable="activity"`,
		`href="/categories/oils"`,
		`class="activity-store"`,
		`href="/stores/1"`,
		`data-activity-open`,
		"name: Clippers",
		"name: Oils",
	} {
		if !strings.Contains(page, want) {
			t.Fatalf("missing %s\n%s", want, page)
		}
	}
}

func TestShellAndStatic(t *testing.T) {
	var buf bytes.Buffer
	err := Templates().ExecuteTemplate(&buf, "shell", Page{
		Locale: "en", Dir: "ltr", Title: "Activity", AppName: "Demo",
		Admin: "Ada", Brand: "Demo", Home: "/", AssetPrefix: "/static",
		Heading: "Activity", Nav: []NavItem{{Href: "/activity", Label: "Activity", Icon: IconClock, Active: true}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(buf.String(), `href="/static/dashboard.css"`) || !strings.Contains(buf.String(), `class="active"`) {
		t.Fatalf("shell: %s", buf.String())
	}

	req := httptest.NewRequest(http.MethodGet, "/dashboard.css", nil)
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, req)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), ".datatable") {
		t.Fatalf("css %d %s", rec.Code, rec.Body.String()[:80])
	}
}
