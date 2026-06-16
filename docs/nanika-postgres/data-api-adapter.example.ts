import type { SupabaseClient } from "@supabase/supabase-js";
import type { NanikaDataAdapter, NanikaDataScope } from "../../src/core/types";

type SupabaseNanikaRow = {
  mapping_json?: unknown;
  feature_set_json?: unknown;
  condition_json?: unknown;
  menu_json?: unknown;
  profile_json?: unknown;
};

type SupabaseNanikaAdapterOptions = {
  supabase: SupabaseClient;
};

const scopeConfig = {
  mappings: {
    view: "nanika_mapping_definitions",
    jsonColumn: "mapping_json",
    upsertRpc: "nanika_upsert_mapping",
    upsertParam: "mapping",
    deleteRpc: "nanika_delete_mapping",
    deleteParam: "mapping_id",
  },
  featureSets: {
    view: "nanika_feature_set_definitions",
    jsonColumn: "feature_set_json",
    upsertRpc: "nanika_upsert_feature_set",
    upsertParam: "feature_set",
    deleteRpc: "nanika_delete_feature_set",
    deleteParam: "feature_set_id",
  },
  conditions: {
    view: "nanika_condition_definitions",
    jsonColumn: "condition_json",
    upsertRpc: "nanika_upsert_condition",
    upsertParam: "condition",
    deleteRpc: "nanika_delete_condition",
    deleteParam: "condition_id",
  },
  menus: {
    view: "nanika_menu_definitions",
    jsonColumn: "menu_json",
    upsertRpc: "nanika_upsert_menu",
    upsertParam: "menu",
    deleteRpc: "nanika_delete_menu",
    deleteParam: "menu_id",
  },
  runtimeProfiles: {
    view: "nanika_runtime_profile_definitions",
    jsonColumn: "profile_json",
    upsertRpc: "nanika_upsert_runtime_profile",
    upsertParam: "runtime_profile",
    deleteRpc: "nanika_delete_runtime_profile",
    deleteParam: "profile_id",
  },
} satisfies Partial<Record<NanikaDataScope, {
  view: string;
  jsonColumn: keyof SupabaseNanikaRow;
  upsertRpc: string;
  upsertParam: string;
  deleteRpc: string;
  deleteParam: string;
}>>;

function getScopeConfig(scope: NanikaDataScope) {
  const config = scopeConfig[scope];

  if (!config) {
    throw new Error(`Unsupported Nanika data scope: ${scope}`);
  }

  return config;
}

export function createSupabaseNanikaDataAdapter({
  supabase,
}: SupabaseNanikaAdapterOptions): NanikaDataAdapter {
  return {
    async list(scope) {
      const config = getScopeConfig(scope);
      const { data, error } = await supabase
        .from(config.view)
        .select(config.jsonColumn)
        .eq("enabled", true)
        .order("sort_order")
        .order("id");

      if (error) throw error;

      return (data ?? []).map((row: SupabaseNanikaRow) => row[config.jsonColumn]);
    },
    async getItem(scope, id) {
      const config = getScopeConfig(scope);
      const { data, error } = await supabase
        .from(config.view)
        .select(config.jsonColumn)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      return data ? (data as SupabaseNanikaRow)[config.jsonColumn] ?? null : null;
    },
    async saveItem(scope, _id, value) {
      const config = getScopeConfig(scope);
      const { error } = await supabase.rpc(config.upsertRpc, {
        [config.upsertParam]: value,
      });

      if (error) throw error;
    },
    async deleteItem(scope, id) {
      const config = getScopeConfig(scope);
      const { error } = await supabase.rpc(config.deleteRpc, {
        [config.deleteParam]: id,
      });

      if (error) throw error;
    },
    async get(_key) {
      return null;
    },
    async set(_key, _value) {
      throw new Error("Key-value Nanika settings are not implemented in this sample adapter.");
    },
    async remove(_key) {
      throw new Error("Key-value Nanika settings are not implemented in this sample adapter.");
    },
  };
}
