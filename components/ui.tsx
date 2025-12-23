
import React, { useState, useEffect, useRef } from 'react';

// --- Badge ---
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'indigo' | 'purple';
  className?: string;
}
export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const variants = {
    success: "bg-green-100 text-green-700 border-green-200",
    warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
    error: "bg-red-100 text-red-700 border-red-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
    neutral: "bg-gray-100 text-gray-700 border-gray-200",
    indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200"
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}
export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    outline: "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-blue-500",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>}
    <input 
      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 transition-all ${error ? 'border-red-500' : ''} ${className}`} 
      {...props} 
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}
export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>}
    <select 
      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white transition-all ${className}`} 
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// --- Combobox (Input with Suggestions) ---
interface ComboboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({ label, value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filtered = query === '' 
    ? options 
    : options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>}
      <input
        type="text"
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm border border-gray-100">
          {filtered.map((opt, idx) => (
            <li 
              key={idx} 
              className="relative cursor-pointer select-none py-2 px-3 hover:bg-blue-50 text-gray-900 transition-colors"
              onClick={() => { setQuery(opt); onChange(opt); setIsOpen(false); }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'full';
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  
  const sizeClasses = {
      md: 'sm:max-w-lg',
      lg: 'sm:max-w-2xl',
      xl: 'sm:max-w-4xl',
      full: 'sm:max-w-[95%] sm:h-[90vh]'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-600 bg-opacity-60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
        <div className={`relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full ${sizeClasses[size]}`}>
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
                 <h3 className="text-xl font-bold leading-6 text-gray-900">{title}</h3>
                 <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-3xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[80vh]">
                {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Card ---
export const Card: React.FC<{children: React.ReactNode, className?: string, title?: string}> = ({children, className='', title}) => (
  <div className={`overflow-hidden rounded-xl bg-white shadow-md border border-gray-100 transition-all hover:shadow-lg ${className}`}>
    {title && <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50"><h3 className="text-sm font-bold uppercase tracking-wider text-gray-600">{title}</h3></div>}
    <div className="px-6 py-5">
      {children}
    </div>
  </div>
);
