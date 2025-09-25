import logoImage from '@/assets/logo.png';

interface LogoImageProps {
  className?: string;
  alt?: string;
}

export function LogoImage({ className = "w-10 h-10 object-contain", alt = "ZapLynx Logo" }: LogoImageProps) {
  return (
    <img 
      src={logoImage} 
      alt={alt}
      className={className}
    />
  );
}