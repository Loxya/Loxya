import type ConfigSchema from './@schema';
import type { SchemaInput, SchemaInfer } from '@/utils/validation';

export type RawGlobalConfig = SchemaInput<typeof ConfigSchema>;
export type GlobalConfig = SchemaInfer<typeof ConfigSchema>;
