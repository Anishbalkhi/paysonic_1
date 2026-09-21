import React from 'react';
import './Button.scss';

export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = null,
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const classes = [
    'c-button',
    `c-button--${variant}`,
    `c-button--${size}`,
    loading || disabled ? 'c-button--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span className="c-button__spinner" />
      ) : (
        icon && <span className="c-button__icon">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

export default Button;
