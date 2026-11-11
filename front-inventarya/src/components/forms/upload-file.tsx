import { useState, useCallback } from "react"
import { Button } from "@nextui-org/react"
import clsx from "clsx"

export const UploadFile = () => {
  const [files, setFiles] = useState<{ name: string; progress: number }[]>([])
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = (newFiles: FileList | null) => {
    if (!newFiles) return

    const fileArray = Array.from(newFiles).map((file) => ({
      name: file.name,
      progress: 0, // Simulado, puedes agregar lógica de carga real
    }))
    setFiles((prev) => [...prev, ...fileArray])
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files)
  }, [])

  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold">Subir archivos</h3>
          <p className="text-gray-500">Arrastra y suelta tus archivos o haz click para seleccionar.</p>
        </div>

        <form
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={clsx(
            "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center space-y-4 cursor-pointer transition",
            dragActive ? "border-blue-600 bg-blue-50" : "border-blue-500"
          )}
        >
          <UploadIcon className="w-12 h-12 text-blue-500" />
          <p className="text-blue-500 text-center">Arrastra y suelta tus archivos o haz click para seleccionar.</p>
          <span className="text-sm text-gray-400">o</span>
          <label htmlFor="file-upload">
            <Button variant="bordered" size="sm">Seleccionar archivos</Button>
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
          </label>
        </form>

        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileIcon className="w-6 h-6 text-gray-400" />
                <p className="text-sm">{file.name}</p>
              </div>
              <div className="flex items-center space-x-2">
                <p className="text-gray-500 text-sm">{file.progress}%</p>
                <div className="w-24 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function FileIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
    )
  }
  
  
  function UploadIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" x2="12" y1="3" y2="15" />
      </svg>
    )
  }