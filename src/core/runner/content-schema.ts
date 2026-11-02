/**
 * 콘텐츠 JSON 스키마.
 *
 * `data/content/<unitId>.json`은 이 스키마를 통과해야 한다.
 * 엔진 ID·모드·predicate·개념 참조가 실제로 있는지는 content-files 검사가 맡는다.
 */
import { z } from 'zod';
import type { EngineId, GoalSpec, HintRule } from '../engine-sdk';
import type {
  ContentActivity,
  ContentTask,
  DiagnoseSpec,
  TaskLinkSpec,
  TaskViewSpec,
  UnitContent,
} from './types';
import type { ResponseField, ResponseFigure, ResponseSpec } from './response/types';

const engineIdSchema = z
  .string()
  .regex(/^E\d{2}$/, '엔진 ID는 E00 형식이어야 합니다.')
  .transform((value) => value as EngineId);

const cpaSchema = z.enum(['C', 'P', 'A']);
const jsonValueSchema = z.json();

const goalSchema: z.ZodType<GoalSpec> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('equals'),
      path: z.string().min(1),
      value: jsonValueSchema,
    }),
    z.object({
      kind: z.literal('equivalent-expr'),
      path: z.string().min(1),
      expr: z.string().min(1),
    }),
    z.object({
      kind: z.literal('predicate'),
      name: z.string().min(1),
      args: jsonValueSchema.optional(),
    }),
    z.object({
      kind: z.literal('all'),
      of: z.array(goalSchema).min(1),
    }),
    z.object({
      kind: z.literal('any'),
      of: z.array(goalSchema).min(1),
    }),
  ]),
);

const hintSchema: z.ZodType<HintRule> = z
  .object({
    when: z.union([goalSchema, z.object({ misconception: z.string().min(1) })]),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    say: z.string().optional(),
    show: z
      .object({
        engine: engineIdSchema,
        overlay: z.string().min(1),
        args: jsonValueSchema.optional(),
      })
      .optional(),
    backtrack: z.string().min(1).optional(),
  })
  .strict();

export const viewSchema: z.ZodType<TaskViewSpec> = z
  .object({
    slot: z.string().min(1),
    engine: engineIdSchema,
    mode: z.string().min(1),
    cpa: cpaSchema,
    config: jsonValueSchema,
  })
  .strict();

export const linkSchema: z.ZodType<TaskLinkSpec> = z
  .object({
    from: z.string().min(1),
    event: z.string().min(1),
    to: z.string().min(1),
  })
  .strict();

const numberFormSchema = z.enum(['integer', 'fraction', 'mixed', 'decimal']);

const figureSchema: z.ZodType<ResponseFigure> = z
  .object({
    engine: engineIdSchema,
    mode: z.string().min(1),
    cpa: cpaSchema,
    config: jsonValueSchema,
  })
  .strict();

const responseFieldSchema: z.ZodType<ResponseField> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('number'),
        id: z.string().min(1),
        label: z.string().min(1).optional(),
        forms: z.array(numberFormSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal('choice'),
        id: z.string().min(1),
        label: z.string().min(1).optional(),
        options: z
          .array(
            z
              .object({
                id: z.string().min(1),
                label: z.string().min(1).optional(),
                figure: figureSchema.optional(),
              })
              .strict(),
          )
          .min(1),
        multiple: z.boolean(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('order'),
        id: z.string().min(1),
        label: z.string().min(1).optional(),
        items: z
          .array(
            z
              .object({
                id: z.string().min(1),
                label: z.string().min(1).optional(),
                figure: figureSchema.optional(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal('compare'),
        id: z.string().min(1),
        label: z.string().min(1).optional(),
        left: z.string().min(1),
        right: z.string().min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal('sort'),
        id: z.string().min(1),
        label: z.string().min(1).optional(),
        cards: z
          .array(z.object({ id: z.string().min(1), label: z.string().min(1) }).strict())
          .min(1),
        bins: z
          .array(z.object({ id: z.string().min(1), label: z.string().min(1) }).strict())
          .min(1),
      })
      .strict(),
  ]),
);

export const responseSchema: z.ZodType<ResponseSpec> = z
  .object({ fields: z.array(responseFieldSchema).min(1) })
  .strict();

const diagnoseSchema: z.ZodType<DiagnoseSpec> = z
  .object({
    code: z.string().regex(/^MC-[A-Z0-9-]+$/, '오개념 코드는 MC-... 형식이어야 합니다.'),
    args: jsonValueSchema.optional(),
    path: z.string().min(1).optional(),
  })
  .strict();

const hintVarsSchema = z.record(z.string().min(1), z.string().min(1));

export const taskSchema: z.ZodType<ContentTask> = z
  .object({
    id: z.string().regex(/^.+\.T[1-9]\d*$/, '과제 ID는 <활동ID>.T<n> 형식이어야 합니다.'),
    prompt: z.string().min(1),
    engine: engineIdSchema,
    mode: z.string().min(1),
    cpa: cpaSchema,
    config: jsonValueSchema,
    goal: goalSchema,
    hints: z.array(hintSchema),
    concepts: z.array(z.string().min(1)),
    submit: z.enum(['auto', 'button']),
    views: z.array(viewSchema).min(1).optional(),
    links: z.array(linkSchema).optional(),
    response: responseSchema.optional(),
    showEngine: z.boolean().optional(),
    hintVars: hintVarsSchema.optional(),
    diagnose: z.array(diagnoseSchema).min(1).optional(),
  })
  .strict()
  .superRefine((task, ctx) => {
    if (task.response) {
      if (task.submit !== 'button') {
        ctx.addIssue({
          code: 'custom',
          path: ['submit'],
          message: 'response가 있으면 submit은 button이어야 합니다.',
        });
      }
      const fieldIds = new Set<string>();
      task.response.fields.forEach((field, index) => {
        if (fieldIds.has(field.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['response', 'fields', index, 'id'],
            message: `응답 필드 id가 중복됩니다: ${field.id}`,
          });
        }
        fieldIds.add(field.id);
      });
    }

    const views = task.views;
    const links = task.links ?? [];
    if (!views) {
      if (links.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['links'],
          message: 'views가 없으면 links를 쓸 수 없습니다.',
        });
      }
      return;
    }

    const slots = new Set<string>();
    views.forEach((view, index) => {
      if (view.slot === 'response') {
        ctx.addIssue({
          code: 'custom',
          path: ['views', index, 'slot'],
          message: 'response는 실행기 예약 슬롯이라 views에 쓸 수 없습니다.',
        });
      }
      if (slots.has(view.slot)) {
        ctx.addIssue({
          code: 'custom',
          path: ['views', index, 'slot'],
          message: `슬롯 이름이 중복됩니다: ${view.slot}`,
        });
      }
      slots.add(view.slot);
    });

    links.forEach((link, index) => {
      if (!slots.has(link.from)) {
        ctx.addIssue({
          code: 'custom',
          path: ['links', index, 'from'],
          message: `없는 슬롯입니다: ${link.from}`,
        });
      }
      if (!slots.has(link.to)) {
        ctx.addIssue({
          code: 'custom',
          path: ['links', index, 'to'],
          message: `없는 슬롯입니다: ${link.to}`,
        });
      }
    });
  });

export const activitySchema: z.ZodType<ContentActivity> = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    tasks: z.array(taskSchema).min(1),
  })
  .strict();

export const unitContentSchema: z.ZodType<UnitContent> = z
  .object({
    unit: z.string().min(1),
    title: z.string().min(1),
    activities: z.array(activitySchema).min(1),
  })
  .strict();

export class ContentSchemaError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`콘텐츠 형식이 올바르지 않습니다: ${issues.slice(0, 3).join(' / ')}`);
    this.name = 'ContentSchemaError';
  }
}

export function parseUnitContent(input: unknown): UnitContent {
  const result = unitContentSchema.safeParse(input);
  if (!result.success) {
    throw new ContentSchemaError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}
