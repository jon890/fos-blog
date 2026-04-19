import Link from "next/link";

interface SectionCTAButtonProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

export function SectionCTAButton({ href, label, icon }: SectionCTAButtonProps) {
  return (
    <div className="flex justify-center mt-6">
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 dark:bg-blue-500 text-white font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {icon}
        {label}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
