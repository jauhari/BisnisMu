"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import type { DefaultValues, FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ZodTypeAny } from "zod";
import { createFormDraft, markSaved, undoFormDraft, updateFormDraft, type FormDraftState } from "@/presentation/state/form-state";
import { defaultAutosavePolicy, shouldAutosave } from "@/presentation/state/autosave";
import { GlassField, GlassForm, GlassInput, GlassSelect } from "./glass-form";

export interface ManagedFormRenderProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  draft: FormDraftState<T>;
  markAsSaved: () => void;
  undo: () => void;
  submitting: boolean;
}

export function ManagedForm<T extends FieldValues>({ schema, defaultValues, onSubmit, resetOnSuccess = true, children }: { schema: ZodTypeAny; defaultValues: DefaultValues<T>; onSubmit: (values: T) => void | Promise<void>; resetOnSuccess?: boolean; children: (props: ManagedFormRenderProps<T>) => ReactNode; }) {
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues, mode: "onChange" });
  const values = form.watch();
  const draft = useMemo(() => updateFormDraft(createFormDraft(defaultValues as T), values as T), [defaultValues, values]);
  const valid = form.formState.isValid;
  const autosaveReady = shouldAutosave(defaultAutosavePolicy, draft.dirty, valid);
  const markAsSaved = () => { void markSaved(draft); };
  const undo = () => { const next = undoFormDraft(draft); form.reset(next.current); };

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  const handleSubmit = form.handleSubmit(async (formValues) => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitOk(false);
    try {
      await onSubmit(formValues as T);
      setSubmitOk(true);
      if (resetOnSuccess) form.reset(defaultValues);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Gagal menyimpan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  });

  return <FormProvider {...form}><GlassForm className="contents" onSubmit={handleSubmit}>{children({ form, draft, markAsSaved, undo, submitting })}{submitError ? <p role="alert" className="text-sm text-danger">{submitError}</p> : null}{submitOk && !submitError ? <p role="status" className="text-sm text-success">Tersimpan.</p> : null}{autosaveReady ? <span className="sr-only">Autosave ready</span> : null}</GlassForm></FormProvider>;
}

export function RhfTextField<T extends FieldValues>({ name, label, placeholder, type = "text" }: { name: Path<T>; label: string; placeholder?: string; type?: string }) {
  const { register, formState: { errors } } = useFormContext<T>();
  const error = errors[name]?.message;
  const fieldProps = typeof error === "string" ? { label, error } : { label };
  return <GlassField {...fieldProps}><GlassInput type={type} placeholder={placeholder} {...register(name)} /></GlassField>;
}

export function RhfSelectField<T extends FieldValues>({ name, label, valueLabel }: { name: Path<T>; label: string; valueLabel: string }) {
  const { setValue } = useFormContext<T>();
  return <GlassField label={label}><GlassSelect><button type="button" className="w-full text-left" onClick={() => setValue(name, valueLabel as never, { shouldDirty: true, shouldValidate: true })}>{valueLabel}</button></GlassSelect></GlassField>;
}

export interface SelectOption { value: string; label: string }

export function RhfDataSelect<T extends FieldValues>({ name, label, options, placeholder = "Pilih...", loading = false }: { name: Path<T>; label: string; options: SelectOption[]; placeholder?: string; loading?: boolean }) {
  const { register, formState: { errors } } = useFormContext<T>();
  const error = errors[name]?.message;
  const fieldProps = typeof error === "string" ? { label, error } : { label };
  return <GlassField {...fieldProps}><select className="h-11 rounded-md border border-border bg-white/60 px-3 text-sm dark:bg-white/8" {...register(name)}><option value="">{loading ? "Memuat..." : placeholder}</option>{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></GlassField>;
}
