"use client";

import type { FieldApi, FieldConfig, FormApi, ValidationIssue } from "@formbar/core";
import { useField } from "@formbar/react";
import type * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "../../lib/utils";
import { Label } from "./label";

const FormContext = React.createContext<FormApi<unknown, unknown> | null>(null);

function useFormContext(): FormApi<unknown, unknown> {
  const ctx = React.useContext(FormContext);
  if (!ctx) throw new Error("useFormContext must be used within <Form>");
  return ctx;
}

interface FormFieldContextValue {
  field: FieldApi<unknown, unknown, string>;
  name: string;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

interface FormProps extends Omit<React.ComponentPropsWithoutRef<"form">, "onSubmit"> {
  form: FormApi<unknown, unknown>;
  onSubmit?: () => void;
}

const Form = React.forwardRef<HTMLFormElement, FormProps>(({ form, onSubmit, children, ...props }, ref) => (
  <FormContext.Provider value={form}>
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        form.submit();
        onSubmit?.();
      }}
      {...props}
    >
      {children}
    </form>
  </FormContext.Provider>
));
Form.displayName = "Form";

interface FormFieldProps {
  name: string;
  form?: FormApi<unknown, unknown>;
  config?: FieldConfig;
  children: (field: FieldApi<unknown, unknown, string>) => React.ReactNode;
}

function FormField({ name, form: formProp, config, children }: FormFieldProps) {
  const formCtx = React.useContext(FormContext);
  const form = formProp ?? formCtx;
  if (!form) throw new Error("FormField must be used within <Form> or receive a form prop");
  const field = useField(form, name, config);
  return <FormFieldContext.Provider value={{ field, name }}>{children(field)}</FormFieldContext.Provider>;
}

function useFormField() {
  const fieldCtx = React.useContext(FormFieldContext);
  const itemCtx = React.useContext(FormItemContext);

  if (!fieldCtx) throw new Error("useFormField should be used within <FormField>");
  if (!itemCtx) throw new Error("useFormField should be used within <FormItem>");

  const { field, name } = fieldCtx;
  const issues = field.issues();
  const errorIssues = issues.filter((i: ValidationIssue) => i.severity === "error");
  const { id } = itemCtx;

  return {
    field,
    name,
    id,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    error: errorIssues[0] as ValidationIssue | undefined,
    issues,
  };
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return <Label ref={ref} className={cn(error && "text-destructive", className)} htmlFor={formItemId} {...props} />;
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<React.ComponentRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : `${formDescriptionId}`}
        aria-invalid={!!error}
        {...props}
      />
    );
  },
);
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();

    return <p ref={ref} id={formDescriptionId} className={cn("text-sm text-muted-foreground", className)} {...props} />;
  },
);
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const body = error ? error.message : children;

    if (!body) {
      return null;
    }

    return (
      <p ref={ref} id={formMessageId} className={cn("text-sm font-medium text-destructive", className)} {...props}>
        {body}
      </p>
    );
  },
);
FormMessage.displayName = "FormMessage";

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormContext,
  useFormField,
};
