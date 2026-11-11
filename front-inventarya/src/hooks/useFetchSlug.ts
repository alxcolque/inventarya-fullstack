import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { tenantApi } from "@/api";


interface UseFetch<T> {
    isLoading: boolean;
    data: undefined | T;
    error: undefined | string;
}

export const useFetchSlug = <T>(url: string): UseFetch<T> => {

    const [data, setData] = useState();
    const [error, setError] = useState(undefined);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        //validate url
        /* if(!url.includes('/@')){
            setError('URL inválida');
            return
        } */
        setIsLoading(true);

        try {
            const response = await tenantApi.get(url);
            setData(response.data);
            setIsLoading(false);
        } catch (error) {
            //console.log(error)
            if( isAxiosError(error) ){
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