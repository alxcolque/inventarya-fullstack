import { create } from "zustand";

export interface IWizardFormData {
  tenant: {
    name: string;
    slug: string;
    database: string;
    business_type_id: number | null;
    owner_name: string;
    owner_email: string;
    owner_phone: string;
    phone_country_code?: string;
    phone_number?: string;
    logo: string | null;
    data: {
      timezone: string;
      country: string;
      local_port?: number;
    };
  };
  domains: Array<{
    domain: string;
    type: 'subdomain' | 'custom';
    is_primary: boolean;
    status: 'pending' | 'active';
  }>;
  subscription: {
    plan_id: number | null;
    billing_cycle: 'monthly' | 'yearly';
    price: number;
    status: 'pending' | 'active';
  };
  payment: {
    amount: number;
    currency: string;
    billing_cycle: 'monthly' | 'yearly';
    method: 'qr' | 'card' | 'bank' | 'paypal';
    status: 'pending' | 'paid';
  };
  owner: {
    name: string;
    email: string;
    phone_country_code?: string;
    phone_number?: string;
    password?: string;
  };
}

interface TenantFormState {
  currentStep: number;
  formData: IWizardFormData;
  stepValidation: Record<number, boolean>;
  isLoading: boolean;
  isSubmitting: boolean;
}

interface TenantFormActions {
  setCurrentStep: (step: number) => void;
  updateSection: <K extends keyof IWizardFormData>(section: K, value: Partial<IWizardFormData[K]>) => void;
  updateDomains: (domains: IWizardFormData['domains']) => void;
  setStepValid: (step: number, isValid: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetForm: () => void;
}

const initialFormData: IWizardFormData = {
  tenant: {
    name: "",
    slug: "",
    database: "",
    business_type_id: null,
    owner_name: "",
    owner_email: "",
    owner_phone: "",
    phone_country_code: "+591",
    phone_number: "",
    logo: null,
    data: {
      timezone: "America/La_Paz",
      country: "BO",
    },
  },
  domains: [
    {
      domain: "",
      type: "subdomain",
      is_primary: true,
      status: "pending",
    },
  ],
  subscription: {
    plan_id: null,
    billing_cycle: "monthly",
    price: 0,
    status: "pending",
  },
  payment: {
    amount: 0,
    currency: "BOB",
    billing_cycle: "monthly",
    method: "qr",
    status: "pending",
  },
  owner: {
    name: "",
    email: "",
    phone_country_code: "+591",
    phone_number: "",
    password: "",
  },
};

export const useTenantFormStore = create<TenantFormState & TenantFormActions>((set) => ({
  currentStep: 0,
  formData: initialFormData,
  stepValidation: {
    0: false, // Company
    1: false, // Domain
    2: false, // Plan
    3: false, // Owner
    4: true,  // Review (always valid)
  },
  isLoading: false,
  isSubmitting: false,

  setCurrentStep: (step) => set({ currentStep: step }),

  updateSection: (section, value) =>
    set((state) => ({
      formData: {
        ...state.formData,
        [section]: {
          ...state.formData[section],
          ...value,
        },
      },
    })),

  updateDomains: (domains) =>
    set((state) => ({
      formData: {
        ...state.formData,
        domains,
      },
    })),

  setStepValid: (step, isValid) =>
    set((state) => ({
      stepValidation: {
        ...state.stepValidation,
        [step]: isValid,
      },
    })),

  nextStep: () =>
    set((state) => {
      if (state.currentStep < 4 && state.stepValidation[state.currentStep]) {
        return { currentStep: state.currentStep + 1 };
      }
      return {};
    }),

  prevStep: () =>
    set((state) => {
      if (state.currentStep > 0) {
        return { currentStep: state.currentStep - 1 };
      }
      return {};
    }),

  resetForm: () =>
    set({
      currentStep: 0,
      formData: initialFormData,
      stepValidation: {
        0: false,
        1: false,
        2: false,
        3: false,
        4: true,
      },
      isLoading: false,
      isSubmitting: false,
    }),
}));
