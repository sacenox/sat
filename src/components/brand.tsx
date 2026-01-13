import Image from "next/image";
import Logo from "@/app/favicon.svg";

export function Brand() {
  return (
    <div className="p-8">
      <div className="text-background bg-foreground rounded-full py-2 px-4 drop-shadow-sm flex flex-row items-center justify-center gap-2">
        <Image
          src={Logo}
          alt="Logo"
          width={32}
          height={32}
          className="invert dark:invert-0"
        />
        <h1 className="text-2xl font-bold">SAT</h1>
      </div>
    </div>
  );
}
