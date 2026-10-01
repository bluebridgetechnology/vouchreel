"use client";

import { WidgetTemplate, WIDGET_TEMPLATES } from "@/lib/validations/widget-config";

interface TemplatePickerProps {
  value?: WidgetTemplate;
  onChange: (template: WidgetTemplate) => void;
}

interface TemplateOption {
  id: WidgetTemplate;
  title: string;
  badge?: string;
  description: string;
  icon: React.ReactNode;
}

export function TemplatePicker({
  value = "floating-card",
  onChange,
}: TemplatePickerProps) {
  const templates: TemplateOption[] = [
    {
      id: "wall-of-love",
      title: "Wall of Love",
      badge: "Popular",
      description:
        "Multi-column responsive grid blending video thumbnails with verified text review cards.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      id: "carousel",
      title: "Carousel / Slider",
      description:
        "Smooth horizontal scrolling testimonial slider with navigation controls and touch swipe.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7h8m-8 5h8m-8 5h8M3 4a1 1 0 011-1h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM1 12h2m18 0h2"
          />
        </svg>
      ),
    },
    {
      id: "story-strip",
      title: "Story Strip",
      badge: "Mobile-first",
      description:
        "Instagram-style interactive bubbles with gradient rings and star badges.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5.5 12a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0zm10 0a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"
          />
        </svg>
      ),
    },
    {
      id: "floating-card",
      title: "Minimal Floating Card",
      badge: "Default",
      description:
        "Unobtrusive bottom-corner floating pill launcher that expands into video player on click.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
          />
        </svg>
      ),
    },
    {
      id: "masonry",
      title: "Masonry Grid",
      description:
        "Pinterest-style staggered columns accommodating varying quote lengths and video cards.",
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v8a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM14 17a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="rounded-card border bg-card p-4 sm:p-6 shadow-xs space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-medium text-foreground">
          Display Template
        </h3>
        <p className="text-xs text-muted-foreground">
          Choose how testimonials and text reviews are presented on your site. All
          templates automatically blend video proof and verified Google/Trustpilot reviews.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
        {templates.map((tmpl) => {
          const isSelected = value === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onChange(tmpl.id)}
              className={`relative flex flex-col justify-between rounded-card border p-4 text-left transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                  : "border-border bg-card/60"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div
                    className={`rounded-card p-2 ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tmpl.icon}
                  </div>
                  {tmpl.badge && (
                    <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
                      {tmpl.badge}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-sm text-foreground">
                    {tmpl.title}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t flex items-center justify-between text-2xs">
                <span className={isSelected ? "font-medium text-primary" : "text-muted-foreground"}>
                  {isSelected ? "Active Template" : "Select Template"}
                </span>
                {isSelected && (
                  <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
