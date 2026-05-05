import type { ComponentType } from "react";
import { BasicContactDemo } from "./01-basic-contact";
import { UserProfileDemo } from "./02-user-profile";
import { NestedAddressDemo } from "./03-nested-address";
import { SettingsPanelDemo } from "./04-settings-panel";
import { ProductEntryDemo } from "./05-product-entry";
import { RichValidationDemo } from "./06-rich-validation";
import { ConditionalFieldsDemo } from "./07-conditional-fields";
import { ArrayItemsDemo } from "./08-array-items";
import { CustomLayoutDemo } from "./09-custom-layout";
import { MultiSectionResponsiveDemo } from "./10-multi-section-responsive";
import { SearchFiltersDemo } from "./11-search-filters";
import { SurveyQuestionnaireDemo } from "./12-survey-questionnaire";
import { MultiSchemaSourcesDemo } from "./13-multi-schema-sources";
import { OrderEntryDemo } from "./14-order-entry";
import { KitchenSinkDemo } from "./15-kitchen-sink";
import { CustomRenderersDemo } from "./16-custom-renderers";
import { CustomLayoutTypesDemo } from "./17-custom-layout";
import { ArbiterVisibilityDemo } from "./18-arbiter-visibility";
import { ArbiterCalculatedDemo } from "./19-arbiter-calculated";
import { ArbiterValidationGatingDemo } from "./20-arbiter-validation-gating";
import { ArbiterDynamicSectionsDemo } from "./21-arbiter-dynamic-sections";

export interface DemoRegistration {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly category: "basic" | "intermediate" | "advanced";
  readonly component: ComponentType;
}

export const demos: readonly DemoRegistration[] = [
  // Basic (1-5)
  {
    id: "basic-contact",
    title: "1. Basic Contact Form",
    subtitle: "Text, email, textarea fields",
    category: "basic",
    component: BasicContactDemo,
  },
  {
    id: "user-profile",
    title: "2. User Profile",
    subtitle: "Multi-column, enums, slider",
    category: "basic",
    component: UserProfileDemo,
  },
  {
    id: "nested-address",
    title: "3. Nested Address",
    subtitle: "Auto-layout nested objects",
    category: "basic",
    component: NestedAddressDemo,
  },
  {
    id: "settings-panel",
    title: "4. Settings Panel",
    subtitle: "Toggle-heavy categorized settings",
    category: "basic",
    component: SettingsPanelDemo,
  },
  {
    id: "product-entry",
    title: "5. Product Entry",
    subtitle: "Numbers, constraints, grid layout",
    category: "basic",
    component: ProductEntryDemo,
  },
  // Intermediate (6-10)
  {
    id: "rich-validation",
    title: "6. Rich Validation",
    subtitle: "Pattern, format, range constraints",
    category: "intermediate",
    component: RichValidationDemo,
  },
  {
    id: "conditional-fields",
    title: "7. Conditional Fields",
    subtitle: "dependentRequired, conditional sections",
    category: "intermediate",
    component: ConditionalFieldsDemo,
  },
  {
    id: "array-items",
    title: "8. Array Items",
    subtitle: "Repeatable fields and object arrays",
    category: "intermediate",
    component: ArrayItemsDemo,
  },
  {
    id: "custom-layout",
    title: "9. Custom Layout",
    subtitle: "Manual layout override for vessels",
    category: "intermediate",
    component: CustomLayoutDemo,
  },
  {
    id: "multi-section",
    title: "10. Multi-Section Responsive",
    subtitle: "Responsive columns that collapse",
    category: "intermediate",
    component: MultiSectionResponsiveDemo,
  },
  // Advanced (11-15)
  {
    id: "search-filters",
    title: "11. Search Filters",
    subtitle: "Compact filter panel UI",
    category: "advanced",
    component: SearchFiltersDemo,
  },
  {
    id: "survey",
    title: "12. Survey / Questionnaire",
    subtitle: "Radio groups, NPS, feedback",
    category: "advanced",
    component: SurveyQuestionnaireDemo,
  },
  {
    id: "multi-schema",
    title: "13. Multiple Schema Sources",
    subtitle: "Minimal vs explicit schemas",
    category: "advanced",
    component: MultiSchemaSourcesDemo,
  },
  {
    id: "order-entry",
    title: "14. Order Entry",
    subtitle: "Invoice with payment & pricing",
    category: "advanced",
    component: OrderEntryDemo,
  },
  {
    id: "kitchen-sink",
    title: "15. Kitchen Sink",
    subtitle: "Every field type and feature",
    category: "advanced",
    component: KitchenSinkDemo,
  },
  {
    id: "custom-renderers",
    title: "16. Custom Renderers",
    subtitle: "Stars, colors, checkboxes, progress",
    category: "advanced",
    component: CustomRenderersDemo,
  },
  {
    id: "custom-layout-types",
    title: "17. Custom Layout Types",
    subtitle: "Tabs, accordion, sections",
    category: "advanced",
    component: CustomLayoutTypesDemo,
  },
  // Arbiter + $ui (18-21)
  {
    id: "arbiter-visibility",
    title: "18. Arbiter: Visibility",
    subtitle: "Rule-driven field visibility via $ui",
    category: "advanced",
    component: ArbiterVisibilityDemo,
  },
  {
    id: "arbiter-calculated",
    title: "19. Arbiter: Calculated",
    subtitle: "Tier detection and computed values",
    category: "advanced",
    component: ArbiterCalculatedDemo,
  },
  {
    id: "arbiter-validation-gating",
    title: "20. Arbiter: Validation Gating",
    subtitle: "Submit gating via $ui.canSubmit",
    category: "advanced",
    component: ArbiterValidationGatingDemo,
  },
  {
    id: "arbiter-dynamic-sections",
    title: "21. Arbiter: Dynamic Sections",
    subtitle: "Insurance form with rule-driven sections",
    category: "advanced",
    component: ArbiterDynamicSectionsDemo,
  },
];
