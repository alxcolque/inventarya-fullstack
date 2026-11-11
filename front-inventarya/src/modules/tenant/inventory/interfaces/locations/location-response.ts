export interface ILocationResponse {
    id: number | string;
    name: string;
    slug: string;
    parent_id?: number | null;
    parent?: { id: number; name: string; slug: string } | null;
    parent_name?: string | null;
    children?: ILocationResponse[];
    full_path?: string;
    created_at?: string;
    updated_at?: string;
}

export type ILocationsResponse = ILocationResponse[];
