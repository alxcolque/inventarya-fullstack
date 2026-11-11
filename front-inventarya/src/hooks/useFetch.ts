import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { tenantApi } from "@/api";
import { useCentralAuthStore } from "@/modules/auth/store/centralAuth.store";


interface UseFetch<T> {
    isLoading: boolean;
    data: undefined | T;
    error: undefined | string;
}

export const useFetch = <T>(url: string): UseFetch<T> => {

    const { token } = useCentralAuthStore();

    const [data, setData] = useState();
    const [error, setError] = useState(undefined);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);

        try {
            const response = await tenantApi.get(url, {
                headers: {
                    Authorization: "Bearer " + token
                }
            });
            setData(response.data);
            setIsLoading(false);
        } catch (error) {
            console.log(error)
            if (isAxiosError(error)) {
                setError(error.response?.data.message);
                setIsLoading(false);
                return
            }
        }
    }

    useEffect(() => {
        fetchData();
    }, [])


    return {
        data,
        error,
        isLoading,
    }
}