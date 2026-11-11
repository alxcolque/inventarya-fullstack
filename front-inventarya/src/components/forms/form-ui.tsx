import { Input, Checkbox, Textarea, Select, SelectItem} from '@nextui-org/react';

interface IFormField {
    name: string;
    label: string;
    type: string;
    options?: { label: string; value: string }[];  // Opciones para el campo select, si aplica
    placeholder?: string;
    defaultValue?: any;   // Valor por defecto
}

interface IFormInputProps {
    fields: IFormField[];
    formData: Record<string, any>;
    onChange: (name: string, value: any) => void;
}

export const FormUI: React.FC<IFormInputProps> = ({ fields, formData, onChange }) => {
    return (
        <>
            {fields.map((field) => (
                <div key={field.name} style={{ marginBottom: '15px' }}>
                    {field.type === 'text' || field.type === 'email' || field.type === 'number' || field.type === 'password' || field.type === 'color' ? (
                        <Input
                            label={field.label}
                            type={field.type}
                            value={formData[field.name]}
                            onChange={(e) => onChange(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            fullWidth
                        />
                    ) : field.type === 'textarea' ? (
                        <Textarea
                            label={field.label}
                            value={formData[field.name]}
                            onChange={(e) => onChange(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            fullWidth
                        />
                    ) : field.type === 'phone' ? (
                        <Input
                            label={field.label}
                            type="tel"
                            value={formData[field.name]}
                            onChange={(e) => onChange(field.name, e.target.value)}
                        />
                    ) : field.type === 'checkbox' ? (
                        <Checkbox
                            isSelected={formData[field.name]}
                            onChange={(checked) => onChange(field.name, checked)}
                        >
                            {field.label}
                        </Checkbox>
                    ) : field.type === 'select' && field.options ? (
                         /* warning: provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility */
                        <Select
                            aria-label={field.label}
                            placeholder={field.placeholder}
                            value={formData[field.name]}
                            onChange={(e) => onChange(field.name, e.target.value)}
                            fullWidth
                        >
                            {field.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </Select>
                    ) : field.type === 'file' ? (
                        <Input
                            label={field.label}
                            type="file"
                            onChange={(e) => onChange(field.name, e.target.files?.[0])}
                            fullWidth
                            accept='image/*'
                        />
                    ) : null}
                </div>
            ))}
        </>
    );
};
