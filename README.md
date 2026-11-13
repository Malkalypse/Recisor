# 📐 Recisor

> A lightweight, zero-dependency layout orchestrator for managing resizable panels, multi-pane sibling grids, and docked edge sidebars in modern web applications.

`Recisor` provides mathematical boundary management, event-driven state tracking, and responsive synchronization for horizontal layout panels using native CSS Flexbox.

---

## ✨ Features

- **Zero Dependencies**: Pure vanilla JavaScript and modular CSS.
- **Automated Sibling Grids**: Automatically injects drag bars between consecutive elements and distributes fluid percentages proportionally.
- **Docked Edge Sidebars**: Supports both left- and right-docked parent/child sidebars with boundary collision detection.
- **Anti-Crush Boundary Engine**: Prevents opposite sidebars from squishing each other or crushing central working areas beyond minimum thresholds.
- **Responsive Normalization**: Built-in `ResizeObserver` integration automatically balances fixed-pixel drag handles against fluid percentage panels when the window or container resizes.
- **Declarative & Manual Modes**: Use one-line automated factories or bind directly to pre-existing markup and custom components with `Recisor.bind()`.
- **Event-Driven Telemetry**: Dispatches bubbling synthetic DOM events (`recisor:dragstart`, `recisor:resize`, `recisor:dragend`) across the layout tree.

---

## 📦 Installation

Link the core stylesheet and script into your project:

```html
<link rel="stylesheet" href="src/recisor.css">
<script src="src/Recisor.js"></script>
```

---

## 🚀 Usage Patterns

### 1. Multi-Sibling Workspace

Generates drag bars automatically between all sequential child panels inside a container.

#### HTML
```html
<div id="sibling-grid">
  <div style="flex: 1;">Panel A</div>
  <div style="flex: 1;" data-recisor-min="180">Panel B (Min: 180px)</div>
  <div style="flex: 1;">Panel C</div>
</div>
```

#### JavaScript
```javascript
const container = document.getElementById('sibling-grid');
Recisor.createSiblingWorkspace(container, {
  minSize: 100 // fallback minimum width in px
});
```

---

### 2. Docked Left Sidebar (Parent/Child)

Injects an internal resize handle along the right edge of a sidebar.

#### HTML
```html
<div id="app-layout">
  <div id="nav-sidebar" style="width: 25%;">Navigation</div>
  <div style="flex-grow: 1;">Main Canvas</div>
</div>
```

#### JavaScript
```javascript
const sidebar = document.getElementById('nav-sidebar');
Recisor.createParentChildWorkspace(sidebar, {
  side: 'right',
  usePercentages: true
});
```

---

### 3. Dual-Docked Workbench (Left & Right Sidebars)

Configure opposite edge sidebars flanking a central flexible canvas. The internal constraint engine ensures neither sidebar can crush the other.

#### HTML
```html
<div id="three-pane-app">
  <div id="left-sidebar" style="width: 20%;">Left Nav</div>
  <div style="flex-grow: 1;">Primary Editor Canvas</div>
  <div id="right-sidebar" style="width: 25%;">Properties Sidebar</div>
</div>
```

#### JavaScript
```javascript
// Left sidebar: handle on right edge
Recisor.createParentChildWorkspace(document.getElementById('left-sidebar'), {
  side: 'right',
  usePercentages: true
});

// Right sidebar: handle on left edge
Recisor.createParentChildWorkspace(document.getElementById('right-sidebar'), {
  side: 'left',
  usePercentages: true
});
```

---

### 4. Non-Invasive Manual Binding

Bind resize behavior directly to existing DOM elements without altering their markup hierarchy, layout models, or CSS classes.

#### HTML
```html
<div class="custom-wrapper">
  <div id="my-panel" style="width: 240px;">Fixed Panel</div>
  <div id="my-drag-handle" class="custom-handle"></div>
  <div style="flex: 1;">Main Content</div>
</div>
```

#### JavaScript
```javascript
const handle = document.getElementById('my-drag-handle');
const panel  = document.getElementById('my-panel');

Recisor.bind(handle, panel, {
  side: 'right',
  minSize: 150
});
```

---

## ⚙️ Configuration Options

Options can be supplied to constructors and factory methods:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `minSize` | `number` | `100` | Fallback minimum width in pixels if not declared on element via `data-recisor-min`. |
| `maxSize` | `number` | `Infinity` | Absolute maximum boundary limit in pixels for resizable panels. |
| `usePercentages` | `boolean` | `false` | When `true`, styles are computed and applied in `%`; otherwise, in `px`. Defaults to `true` for sibling grids. |
| `side` | `string` | `'right'` | For parent/child sidebars, specifies which edge hosts the drag handle (`'left'` or `'right'`). |
| `handleClass` | `string` | `''` | Custom CSS class name appended to generated handle DOM elements. |
| `id` | `string` | `null` | Optional DOM `id` attribute assigned to the generated handle element. |

---

## 🏷️ HTML Data Attributes

Panels can declaratively configure individual sizing boundaries via `data-*` attributes:

```html
<!-- Set custom min/max constraints on individual panels -->
<div class="panel" data-recisor-min="250" data-recisor-max="600">...</div>
```

| Attribute | Description |
| :--- | :--- |
| `data-recisor-min` | Minimum allowable pixel width for the specific panel. |
| `data-recisor-max` | Maximum allowable pixel width for the specific panel. |
| `data-recisor-handle` | Identifies a pre-existing DOM node as a draggable handle. |
| `data-recisor-mode` | Internal/declarative mode: `'sibling'` or `'parent'`. |
| `data-recisor-side` | For parent mode: specifies the handle edge (`'left'` or `'right'`). |

---

## 📡 Event Telemetry

`Recisor` dispatches standard bubbling `CustomEvent` instances from its container element. You can capture these on the workspace or globally on `document`:

```javascript
document.addEventListener('recisor:dragstart', (e) => {
  console.log('Drag started:', e.detail);
});

document.addEventListener('recisor:resize', (e) => {
  console.log('Resizing to:', e.detail.leftWidth);
});

document.addEventListener('recisor:dragend', (e) => {
  console.log('Drag complete:', e.detail);
});
```

### Event Payload (`e.detail`)

```typescript
{
  mode: 'parent' | 'sibling',
  side: 'left' | 'right',
  leftPanel: HTMLElement,
  rightPanel: HTMLElement | null,
  dragBar: HTMLElement,
  leftWidth?: number,
  rightWidth?: number
}
```

---

## 🛠️ API Reference

### Static Factory Methods

- **`Recisor.createSiblingWorkspace(container, options)`**  
  Injects drag handles between all children of `container`, sets up responsive percentage allocation, and activates a `ResizeObserver`.

- **`Recisor.createParentChildWorkspace(panel, options)`**  
  Marks structural layout wrapper classes and delegates to `injectHandle` to dock a handle along the specified edge.

- **`Recisor.injectHandle(panel, options)`**  
  Creates and inserts a drag handle inside `panel` without mutating parent layout classes.

- **`Recisor.bind(handle, targetPanel, options)`**  
  Connects an existing handle element to a panel. Does not create or move any DOM elements.

### Instance Methods

- **`instance.destroy()`**  
  Disconnects internal `ResizeObserver` instances and removes all attached `mousedown`, `mousemove`, and `mouseup` event listeners.

---

## 📄 License

MIT