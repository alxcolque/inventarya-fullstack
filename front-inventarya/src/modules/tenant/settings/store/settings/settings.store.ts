import { create } from "zustand";
import { tenantApi } from "@/api";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { IListSettings } from "../../interfaces/settings/list-response";
import { IUpdateSettingPayload } from "../../interfaces/settings/update-settings-request";
import { useCurrencyStore } from "@/stores/currency/currency.store";
import { applyPrimaryColorTheme } from "@/utils/themeColor";

const defaultCompany: IListSettings = {
  id: 1,
  business_name: 'Inventarya Sucursal',
  name: 'Inventarya Sucursal',
  logo: '',
  favicon: '/favicon.ico',
  email: 'contacto@inventarya.com',
  phone: '',
  address: '',
  theme: 'light',
  primary_color: '#3b82f6',
  currency: '',
  timezone: 'America/La_Paz',
  social: {
    facebook: '',
    instagram: '',
    tiktok: '',
    whatsapp: '',
  },
  terms: '',
  policy: '',
  enable_customers: false,
  enable_suppliers: false,
  enable_locations: false,
  electronic_invoicing_enabled: false,
  tax_nit: '',
  tax_business_name: '',
  siat_environment: 2,
  siat_modality: 1,
  siat_system_code: '',
  siat_token_configured: false,
  siat_certificate_password_configured: false,
  electronic_invoicing_status: 'disabled',
  description: 'Sistema integral de inventario y ventas',
  header: 'Inventarya',
  contact: '',
  support: '',
  footer: '© 2026 Inventarya. Todos los derechos reservados.',
};

interface SettingState {
  setting: IListSettings | null;
  settings: IListSettings[];
  systemData: IListSettings;
  isLoading: boolean;
  isSaving: boolean;
}

interface Actions {
  getSystemData: () => Promise<void>;
  getSettings: (id?: number) => Promise<IListSettings | null>;
  updateSettings: (payload: Partial<IUpdateSettingPayload> | FormData) => Promise<boolean>;
  updatedSetting: (
    id: number,
    name: string,
    logo: string,
    description: string,
    header: string,
    contact: string,
    support: string,
    social: string,
    footer: string
  ) => Promise<void>;
}

export const useSettingStore = create<SettingState & Actions>((set, get) => ({
  setting: null,
  settings: [],
  systemData: defaultCompany,
  isLoading: false,
  isSaving: false,

  getSystemData: async () => {
    try {
      const { data } = await tenantApi.get<{
        setting?: IListSettings;
        tenant?: {
          id: string;
          name: string;
          slug: string;
          domain?: string | null;
        } | null;
        branding?: {
          name?: string;
          business_name?: string;
          logo?: string | null;
          favicon?: string | null;
          primary_color?: string;
          theme?: string;
        } | null;
      }>('/system-data');

      if (data?.setting || data?.branding || data?.tenant) {
        const item: IListSettings = {
          ...defaultCompany,
          ...(data.setting || {}),
        };

        const resolvedName =
          data.branding?.business_name ||
          data.branding?.name ||
          data.tenant?.name ||
          data.setting?.business_name ||
          data.setting?.name;

        if (resolvedName && resolvedName !== 'Inventarya Sucursal') {
          item.business_name = resolvedName;
          item.name = resolvedName;
        } else if (item.business_name && item.business_name !== 'Inventarya Sucursal') {
          item.name = item.business_name;
        } else if (item.name && item.name !== 'Inventarya Sucursal') {
          item.business_name = item.name;
        }

        // Logo resolution: prefer branding logo, filter out fake /logo.png
        if (data.branding && 'logo' in data.branding) {
          item.logo = data.branding.logo || '';
        } else if (item.logo === '/logo.png' || item.logo === 'logo.png') {
          item.logo = '';
        }

        if (data.branding?.favicon) {
          item.favicon = data.branding.favicon;
        }

        if (typeof document !== 'undefined') {
          if (item.business_name && item.business_name !== 'Inventarya Sucursal') {
            document.title = `${item.business_name} | Portal`;
          }
          if (item.favicon) {
            const faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (faviconLink) {
              faviconLink.href = item.favicon;
            }
          }
        }

        if (item.currency) {
          useCurrencyStore.getState().setCurrency(item.currency);
        }

        if (data.branding?.primary_color) {
          item.primary_color = data.branding.primary_color;
        }
        if (item.primary_color) {
          applyPrimaryColorTheme(item.primary_color);
        }

        set({ systemData: item, setting: item });
        return;
      }
    } catch {
      // fallback
    }
    set({ systemData: defaultCompany });
  },

  getSettings: async (_id?: number) => {
    set({ isLoading: true });
    try {
      const { data } = await tenantApi.get<any>('/settings');
      const resolvedSetting: IListSettings = data?.setting || data || defaultCompany;

      // Normalization
      if (!resolvedSetting.business_name && resolvedSetting.name) {
        resolvedSetting.business_name = resolvedSetting.name;
      }
      if (!resolvedSetting.name && resolvedSetting.business_name) {
        resolvedSetting.name = resolvedSetting.business_name;
      }

      if (resolvedSetting.currency) {
        useCurrencyStore.getState().setCurrency(resolvedSetting.currency);
      }

      if (resolvedSetting.primary_color) {
        applyPrimaryColorTheme(resolvedSetting.primary_color);
      }

      set({
        setting: resolvedSetting,
        settings: [resolvedSetting],
        systemData: resolvedSetting,
        isLoading: false,
      });

      return resolvedSetting;
    } catch (error) {
      set({ isLoading: false });
      if (isAxiosError(error)) {
        toast.error("Error al obtener la configuración", {
          description: error.response?.data?.message,
        });
      }
      return null;
    }
  },

  updateSettings: async (payload: Partial<IListSettings> | FormData) => {
    set({ isSaving: true });
    try {
      const isFormData = payload instanceof FormData;
      const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined;

      const { data } = await tenantApi.post<any>('/settings', payload, { headers });
      const updated: IListSettings = data?.setting || data;

      if (!updated.business_name && updated.name) {
        updated.business_name = updated.name;
      }
      if (!updated.name && updated.business_name) {
        updated.name = updated.business_name;
      }

      if (updated.currency) {
        useCurrencyStore.getState().setCurrency(updated.currency);
      }

      if (updated.primary_color) {
        applyPrimaryColorTheme(updated.primary_color);
      }

      set({
        setting: updated,
        settings: [updated],
        systemData: updated,
        isSaving: false,
      });

      toast.success(data?.message || "Configuración guardada exitosamente");
      return true;
    } catch (error) {
      set({ isSaving: false });
      if (isAxiosError(error)) {
        toast.error("Error al actualizar la configuración", {
          description: error.response?.data?.message || "Verifique los datos ingresados",
        });
      }
      return false;
    }
  },

  // Backward compatibility alias
  updatedSetting: async (id, name, logo, description, header, contact, support, social, footer) => {
    await get().updateSettings({
      id,
      business_name: name,
      name,
      logo,
      description,
      header,
      phone: contact,
      email: support,
      footer,
      social: typeof social === 'string' ? { whatsapp: social } : social,
    });
  },
}));
