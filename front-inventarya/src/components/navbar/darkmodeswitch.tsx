
import { useTheme as useNextTheme } from "next-themes";
import { Switch } from "@nextui-org/react";
import { AiFillMoon, AiFillSun } from "react-icons/ai";

export const DarkModeSwitch = () => {
  const { setTheme, resolvedTheme } = useNextTheme();
  return (
    <Switch
      color="warning"
      startContent={<AiFillSun />}
      endContent={<AiFillMoon />}
      isSelected={resolvedTheme === "dark" ? true : false}
      onValueChange={(e) => setTheme(e ? "dark" : "light")}
    />
  );
};
