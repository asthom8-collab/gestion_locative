interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button' }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors'
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    ghost: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
    danger: 'text-rose-600 hover:bg-rose-50',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}>
      {children}
    </button>
  )
}
