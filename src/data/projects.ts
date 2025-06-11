export interface Project {
    title: string;
    description: string;
    image: string;
    technologies: string[];
    link: string;
}

export const projects: Project[] = [
    {
        title: "Freshcold",
        description: "Desarrollo de página web para empresa de alimentos para una exposición en internet y ampliar su alcance.",
        image: "https://placehold.co/600x400/4A148C/FFFFFF?text=Freshcold",
        technologies: ["Astro", "Tailwind"],
        link: "https://freshcold.netlify.app/"
    },
]; 