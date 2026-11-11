import React, { useEffect, useState } from 'react';
import { LuHome, LuTag, LuHelpCircle, LuPhone, LuStore } from 'react-icons/lu';

interface LandingMenuProps {
  onContactClick?: () => void;
}

export const scrollToSection = (id: string) => {
  if (id === 'inicio') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const element = document.getElementById(id);
  if (element) {
    const navbarOffset = 75;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - navbarOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
};

/**
 * Desktop menu rendered inside the top NavbarComponent
 * Only active and visible on Landing page on desktop (md:flex)
 */
export const LandingNavbarMenu: React.FC<LandingMenuProps> = ({ onContactClick }) => {
  const [activeSection, setActiveSection] = useState<string>('inicio');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 160;
      const buscarEl = document.getElementById('buscar-tienda');
      const planesEl = document.getElementById('planes');
      const faqsEl = document.getElementById('faqs');
      const contactoEl = document.getElementById('contacto');

      if (contactoEl && scrollPos >= contactoEl.offsetTop) {
        setActiveSection('contacto');
      } else if (faqsEl && scrollPos >= faqsEl.offsetTop) {
        setActiveSection('faqs');
      } else if (planesEl && scrollPos >= planesEl.offsetTop) {
        setActiveSection('planes');
      } else if (buscarEl && scrollPos >= buscarEl.offsetTop) {
        setActiveSection('buscar-tienda');
      } else {
        setActiveSection('inicio');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'INICIO', id: 'inicio', onClick: () => scrollToSection('inicio') },
    { label: 'MI TIENDA', id: 'buscar-tienda', onClick: () => scrollToSection('buscar-tienda') },
    { label: 'PRECIOS', id: 'planes', onClick: () => scrollToSection('planes') },
    {
      label: 'CONTACTAR',
      id: 'contacto',
      onClick: () => {
        if (onContactClick) onContactClick();
        else scrollToSection('contacto');
      },
    },
    { label: 'FAQS', id: 'faqs', onClick: () => scrollToSection('faqs') },
  ];

  return (
    <div className="hidden md:flex items-center gap-6">
      {navItems.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={`text-xs font-bold uppercase tracking-wider transition-colors px-2.5 py-1 rounded-md ${
            activeSection === item.id
              ? 'text-primary bg-primary/10'
              : 'text-default-600 hover:text-primary hover:bg-default-100'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

/**
 * Fixed Bottom Navigation Bar for Mobile WebApp style
 * Only rendered on Landing page on mobile (md:hidden)
 */
export const LandingBottomBar: React.FC<LandingMenuProps> = ({ onContactClick }) => {
  const [activeSection, setActiveSection] = useState<string>('inicio');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 220;
      const buscarEl = document.getElementById('buscar-tienda');
      const planesEl = document.getElementById('planes');
      const faqsEl = document.getElementById('faqs');
      const contactoEl = document.getElementById('contacto');

      if (contactoEl && scrollPos >= contactoEl.offsetTop) {
        setActiveSection('contacto');
      } else if (faqsEl && scrollPos >= faqsEl.offsetTop) {
        setActiveSection('faqs');
      } else if (planesEl && scrollPos >= planesEl.offsetTop) {
        setActiveSection('planes');
      } else if (buscarEl && scrollPos >= buscarEl.offsetTop) {
        setActiveSection('buscar-tienda');
      } else {
        setActiveSection('inicio');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const items = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: <LuHome className="w-5 h-5" />,
      onClick: () => scrollToSection('inicio'),
    },
    {
      id: 'buscar-tienda',
      label: 'Mi Tienda',
      icon: <LuStore className="w-5 h-5" />,
      onClick: () => scrollToSection('buscar-tienda'),
    },
    {
      id: 'planes',
      label: 'Precios',
      icon: <LuTag className="w-5 h-5" />,
      onClick: () => scrollToSection('planes'),
    },
    {
      id: 'contacto',
      label: 'Contacto',
      icon: <LuPhone className="w-5 h-5" />,
      onClick: () => {
        if (onContactClick) onContactClick();
        else scrollToSection('contacto');
      },
    },
    {
      id: 'faqs',
      label: 'FAQs',
      icon: <LuHelpCircle className="w-5 h-5" />,
      onClick: () => scrollToSection('faqs'),
    },
  ];

  return (
    <nav
      aria-label="Navegación móvil webapp"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-divider shadow-lg"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 4px)' }}
    >
      <div className="flex items-stretch w-full px-1 pt-1 pb-1">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 px-0.5 rounded-xl transition-all duration-200 active:scale-95 min-w-0 overflow-hidden ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-default-400 hover:text-foreground hover:bg-default-100/60'
              }`}
            >
              <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[9px] leading-none truncate w-full text-center font-semibold ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
