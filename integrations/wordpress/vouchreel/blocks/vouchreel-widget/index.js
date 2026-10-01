(function (wp) {
  var registerBlockType = wp.blocks.registerBlockType;
  var createElement = wp.element.createElement;
  var InspectorControls = wp.blockEditor.InspectorControls || wp.editor.InspectorControls;
  var PanelBody = wp.components.PanelBody;
  var TextControl = wp.components.TextControl;

  registerBlockType("vouchreel/widget", {
    edit: function (props) {
      var attributes = props.attributes;
      var setAttributes = props.setAttributes;

      return createElement(
        "div",
        {
          style: {
            padding: "20px",
            border: "1px dashed #6366f1",
            borderRadius: "8px",
            background: "#f8fafc",
            textAlign: "center",
          },
        },
        createElement(
          InspectorControls,
          null,
          createElement(
            PanelBody,
            { title: "VouchReel Settings", initialOpen: true },
            createElement(TextControl, {
              label: "Space Embed Key",
              help: "Leave empty to use the global key from Settings → VouchReel",
              value: attributes.embedKey || "",
              onChange: function (val) {
                setAttributes({ embedKey: val });
              },
            })
          )
        ),
        createElement(
          "div",
          null,
          createElement(
            "p",
            { style: { fontWeight: "bold", margin: "0 0 6px 0", color: "#1e293b" } },
            "📹 VouchReel Video Testimonials Widget"
          ),
          createElement(
            "p",
            { style: { fontSize: "12px", color: "#64748b", margin: 0 } },
            attributes.embedKey
              ? "Using Space Embed Key: " + attributes.embedKey
              : "Using global Embed Key from Settings → VouchReel"
          )
        )
      );
    },
    save: function () {
      // Dynamic block rendered via PHP render_callback
      return null;
    },
  });
})(window.wp);
