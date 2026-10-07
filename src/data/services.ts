export type ServiceAccent = 'green' | 'blue';

export type ServiceIcon = 'layers' | 'monitor' | 'home' | 'api' | 'chart' | 'clipboard';

export interface Service {
  title: string;
  description: string;
  items: string[];
  accent: ServiceAccent;
  icon: ServiceIcon;
}

export const services: Service[] = [
  {
    title: 'Desarrollo de Sitios Web Corporativos de Alto Impacto',
    description:
      'Crea una primera impresión inolvidable y atrae a tu cliente ideal con un diseño profesional y optimizado para SEO.',
    items: ['Diseño Responsive y Moderno', 'Optimización SEO On-Page', 'Gestión de Contenido (CMS)'],
    accent: 'green',
    icon: 'layers',
  },
  {
    title: 'Aplicaciones Web a Medida y Herramientas',
    description:
      'Optimiza tus operaciones internas y mejora la interacción con tus usuarios a través de herramientas personalizadas y eficientes.',
    items: ['Herramientas Internas personalizadas', 'Automatización de Procesos', 'Aplicaciones Web Interactivas'],
    accent: 'blue',
    icon: 'monitor',
  },
  {
    title: 'Plataformas Digitales (e-commerce, Portales, SaaS)',
    description:
      'Expande tu alcance y genera nuevas fuentes de ingreso con plataformas robustas, seguras y escalables que facilitan la interacción y transacción.',
    items: ['Tiendas Online (e-commerce)', 'Portales de Usuario', 'Sistemas SaaS'],
    accent: 'green',
    icon: 'home',
  },
  {
    title: 'Desarrollo de APIs e Integraciones',
    description:
      'Conecta tus herramientas y automatiza procesos para una operación más fluida y una gestión de datos centralizada.',
    items: ['Diseño y Desarrollo de APIs RESTful', 'Integraciones con Servicios de Terceros', 'Sincronización de Datos'],
    accent: 'blue',
    icon: 'api',
  },
  {
    title: 'Consultoría Web y Optimización',
    description:
      'Recibe asesoramiento experto para mejorar el rendimiento, la seguridad y la experiencia de usuario de tus activos digitales existentes.',
    items: ['Análisis de Rendimiento', 'Auditoría de Seguridad', 'Estrategia Digital'],
    accent: 'green',
    icon: 'chart',
  },
  {
    title: 'Mantenimiento y Soporte Continuo',
    description: 'Asegura que tus plataformas web se mantengan actualizadas, seguras y funcionando sin problemas.',
    items: ['Actualizaciones Periódicas', 'Monitoreo de Seguridad', 'Soporte Técnico'],
    accent: 'blue',
    icon: 'clipboard',
  },
];
