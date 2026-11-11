// components/RichTextEditor.js

import 'react-quill/dist/quill.snow.css';
import { Input } from '@nextui-org/react';
import ReactQuill from 'react-quill';

export const RichTextEditor = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (value: string) => void, placeholder: string }) => {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <Input
        label={label}
        fullWidth
        style={{ display: 'none' }} // Oculta el campo de texto de NextUI, pero lo mantiene como etiqueta
      
      />
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ borderRadius: '8px' }}
      />
    </div>
  );
};
