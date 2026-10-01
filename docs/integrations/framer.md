# Framer Integration Guide

This guide details how to integrate VouchReel into your Framer website, both using Framer's site-wide custom code settings and via custom React Code Components.

---

## Method 1: Site-Wide Custom Code (Easiest)

1. Open your project in **Framer**.
2. Click the gear icon in the top toolbar to open **Site Settings**.
3. Under **General**, scroll down to the **Custom Code** section.
4. Locate the **End of `<body>` tag** input box.
5. Paste your VouchReel script snippet:

```html
<!-- VouchReel Video Testimonials Widget -->
<script async src="https://app.vouchreel.com/widget/YOUR_EMBED_KEY.js" data-key="YOUR_EMBED_KEY"></script>
```

6. Click **Save** and **Publish** your site.

---

## Method 2: Custom React Code Component

If you prefer a modular, drag-and-drop component inside the Framer canvas:

1. In Framer, go to the **Assets** tab on the left sidebar.
2. Under **Code**, click **+ New Component** and name it `VouchreelWidget.tsx`.
3. Replace the contents of the file with the following React code:

```tsx
import { useEffect } from "react";
import { addPropertyControls, ControlType } from "framer";

interface Props {
  embedKey: string;
}

export default function VouchreelWidget({ embedKey = "YOUR_EMBED_KEY" }: Props) {
  useEffect(() => {
    if (!embedKey) return;

    // Avoid injecting duplicate scripts if already on the page
    const existing = document.querySelector(`script[data-key="${embedKey}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.src = `https://app.vouchreel.com/widget/${embedKey}.js`;
    script.async = true;
    script.setAttribute("data-key", embedKey);
    document.body.appendChild(script);

    return () => {
      // Optional cleanup on unmount if needed
    };
  }, [embedKey]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(99, 102, 241, 0.08)",
        border: "1px dashed #6366f1",
        borderRadius: "8px",
        fontSize: "12px",
        color: "#4f46e5",
        fontFamily: "sans-serif",
      }}
    >
      📹 VouchReel Widget ({embedKey ? embedKey : "No Embed Key Set"})
    </div>
  );
}

// Expose property controls in Framer Inspector panel
addPropertyControls(VouchreelWidget, {
  embedKey: {
    type: ControlType.String,
    title: "Embed Key",
    defaultValue: "YOUR_EMBED_KEY",
    placeholder: "spc_abc12345",
  },
});
```

4. Save the code file (`Cmd + S` / `Ctrl + S`).
5. Drag your new `VouchreelWidget` component from the Assets panel anywhere onto your canvas.
6. In the right-hand properties sidebar, enter your Space Embed Key.
7. Publish your site!
