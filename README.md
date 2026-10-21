# Reusable Go HTMX dashboard components

Sidebar shell, data table, custom select, image upload, and an activity old/new viewer. Taken from the Black Brand admin and kept free of that app's routes and database.

Import it from another Go service:

```
go get github.com/ht3aa/reusable-go-htmx-components
```

```go
import "github.com/ht3aa/reusable-go-htmx-components/dashboard"

mux.Handle("/static/", http.StripPrefix("/static/", dashboard.Handler()))

page := dashboard.Page{
    Locale: "en", Dir: "ltr", Title: "Orders", AppName: "Demo",
    Admin: "Ada", Brand: "Demo", Home: "/admin", AssetPrefix: "/static",
    Heading: "Orders", CSRF: token,
    Nav: []dashboard.NavItem{{Href: "/admin/orders", Label: "Orders", Icon: dashboard.IconReceipt, Active: true}},
}
table := dashboard.New("orders", dashboard.Text{
    Search: "Search", Columns: "Columns", All: "All", Empty: "Nothing to show yet.",
    Create: "Create", SelectAll: "Select all", Showing: "Showing", Of: "of",
    Selected: "selected", Rows: "Rows", Prev: "Previous", Next: "Next",
})
```

Render `shell` for the page and `dataTable` for a table. `selectField` and `imageField` are the form controls. `dashboard.js` binds them on load and again after `htmx:afterSwap`. Set `Page.HTMX` to your htmx script URL when the page uses HTMX. Column visibility is stored in `localStorage` under `dashboard-table:<id>`.

`Changes` renders the View control for a JSON payload `{"old":{...},"new":{...}}`. Hover shows the values, and a click opens the same values in a dialog. `Record` renders a name, a link to that record, and the stores it belongs to.
