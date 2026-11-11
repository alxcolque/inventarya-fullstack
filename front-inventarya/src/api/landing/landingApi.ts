import axios from 'axios';
import {
  ILandingDataResponse,
  IConfiguration,
  ILandingPlan,
  IFaq,
  IPublicTenant,
  IResolveTenantResponse,
} from '@/interface/landing.interface';

import { getApiBaseUrl } from '@/utils/apiConfig';

const API_BASE = getApiBaseUrl();

export const getLandingData = async (): Promise<ILandingDataResponse> => {
  const response = await axios.get<ILandingDataResponse>(`${API_BASE}/landing/data`);
  return response.data;
};

export const getPublicPlans = async (): Promise<ILandingPlan[]> => {
  const response = await axios.get<ILandingPlan[]>(`${API_BASE}/public/plans`);
  return response.data;
};

export const getPublicFaqs = async (): Promise<IFaq[]> => {
  const response = await axios.get<IFaq[]>(`${API_BASE}/public/faqs`);
  return response.data;
};

export const getPublicConfiguration = async (): Promise<IConfiguration> => {
  const response = await axios.get<IConfiguration>(`${API_BASE}/public/configurations`);
  return response.data;
};

export const searchPublicTenants = async (query: string = ''): Promise<IPublicTenant[]> => {
  const response = await axios.get<IPublicTenant[]>(`${API_BASE}/public/tenants/search`, {
    params: { query },
  });
  return response.data;
};

export const resolvePublicTenant = async (input: string): Promise<IResolveTenantResponse> => {
  const response = await axios.get<IResolveTenantResponse>(`${API_BASE}/public/tenants/resolve`, {
    params: { input },
  });
  return response.data;
};
