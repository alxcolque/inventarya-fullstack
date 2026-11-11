import { Button } from '@nextui-org/react'
import { useNavigate } from 'react-router-dom';

interface Props {
    title: string;
    description?: string;
    subtitle?: string;
    btnTitle?: string;
    btnPath?: string;
}

export const HeaderPage = ({ btnPath, btnTitle, description, subtitle, title }: Props) => {
    const navigate = useNavigate();

    return (
        <section className='pt-8'>
          <div className='header flex flex-col sm:flex-row sm:items-center sm:justify-between'> 
            <div>
              <h1 className='text-2xl font-bold'>{ title }</h1>
              {(description || subtitle) && <p className="text-default-500 mt-1">{ description || subtitle }</p>}
            </div>

            {btnTitle && btnPath && (
              <Button onClick={() => navigate(btnPath)} className='btn-primary mt-4 sm:mt-0'> 
                { btnTitle }
              </Button> 
            )}
          </div>
        </section>
    )
}
