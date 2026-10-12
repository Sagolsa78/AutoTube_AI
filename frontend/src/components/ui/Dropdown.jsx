import React, { useState, useRef, useEffect } from 'react';
import Icon from '../Icon';

export default function Dropdown({ trigger, children, align = 'right', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={ref}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-56 rounded-xl bg-bg-1 border border-border shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in slide-in-from-top-2 duration-100 ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
          role="menu"
          onClick={() => setIsOpen(false)}
        >
          <div className="py-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ children, icon, onClick, className = '', danger = false }) {
  return (
    <button
      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-text-primary hover:bg-bg-2'
      } ${className}`}
      onClick={onClick}
      role="menuitem"
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="h-px bg-border my-1" />;
}
