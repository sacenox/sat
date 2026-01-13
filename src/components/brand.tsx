import Image from "next/image";
import Logo from "@/app/favicon.svg";

export function Brand() {
  return (
    <div className="p-8">
      <div className="bg-foreground rounded-full p-1 drop-shadow-sm">
        <Image
          src={Logo}
          alt="Logo"
          width={32}
          height={32}
          className="invert dark:invert-0"
        />
      </div>
      <h1 className="text-2xl font-bold pt-4">SAT</h1>
    </div>
  );
}
