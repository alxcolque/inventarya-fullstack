// components/RichTextDisplay.js

export const RichTextDisplay = ({ content }: { content: string }) => {
  return (
    <div
      dangerouslySetInnerHTML={{ __html: content }}
      style={{
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '8px',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    />
  );
};
