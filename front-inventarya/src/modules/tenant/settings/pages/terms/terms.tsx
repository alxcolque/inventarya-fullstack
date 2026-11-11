
import { Navigate, useParams } from "react-router-dom";
import { useFetch } from "@/hooks";
import { toast } from "sonner";
import { Button, CircularProgress, Textarea } from "@nextui-org/react";
import { DynamicBreadcrumbs } from "@/components";
import { useState, useEffect } from "react";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useTermsStore } from "../../store/terms/terms.store";



interface ISimpleSettingResponse {
    setting: {
        terms: string;
        policy: string;
    }
}

export const Terms = () => {
    const { id } = useParams();
    const token = useTenantAuthStore(state => state.token);
    const { data, error, isLoading } = useFetch<ISimpleSettingResponse>(`/settings/${id}`);

    const updateTerms = useTermsStore((state) => state.updateTerms);
    const [formData, setFormData] = useState({
        terms: data?.setting.terms ?? "",
        policy: data?.setting.policy ?? "",
    });

    useEffect(() => {
        setFormData(data?.setting ?? { terms: "", policy: "" });
    }, [data]);

    if (error) {
        toast.error(error)
        return <Navigate to={'/terms/1'} />
    }
    if (isLoading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center">
                <CircularProgress />
                <p>Cargando Logs</p>
            </div>
        )
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        updateTerms(id!, formData.terms, formData.policy, token!);
    }
    return (
        <div className="my-2 px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
            {/* Content here */}
            <DynamicBreadcrumbs title="Términos y Condiciones" />

            <div className="container">
                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-2">
                        <Textarea
                            name="terms"
                            label="Términos"
                            value={formData.terms}
                            onChange={handleChange}

                        />
                        <Textarea
                            name="policy"
                            label="Política"
                            value={formData.policy}
                            onChange={handleChange}
                        />

                    </div>
                    <Button className="flex justify-end mt-2" color="primary" type="submit">Guardar</Button>
                </form>

            </div>
        </div >
    )
}

