import React from "react";
import { Card, CardBody } from "@nextui-org/react";

interface ProductGridSkeletonProps {
  count?: number;
  viewMode?: "cards" | "list";
}

export const ProductGridSkeleton: React.FC<ProductGridSkeletonProps> = ({
  count = 8,
  viewMode = "cards",
}) => {
  const items = Array.from({ length: count });

  if (viewMode === "list") {
    return (
      <div className="bg-background border border-default-200 rounded-xl overflow-hidden p-3 flex flex-col gap-3">
        {items.map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 animate-pulse py-1">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 rounded-lg bg-default-200 shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1 max-w-[200px]">
                <div className="h-3 bg-default-200 rounded w-full" />
                <div className="h-2.5 bg-default-100 rounded w-2/3" />
              </div>
            </div>
            <div className="h-5 w-12 bg-default-100 rounded" />
            <div className="h-5 w-14 bg-default-200 rounded" />
            <div className="h-7 w-20 bg-default-200 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-2.5">
      {items.map((_, i) => (
        <Card
          key={i}
          className="border border-default-200 bg-background shadow-sm animate-pulse flex flex-col justify-between"
        >
          <div className="aspect-square w-full bg-default-200/70" />
          <CardBody className="p-2 sm:p-2.5 flex flex-col gap-2">
            <div className="h-3 bg-default-200 rounded w-3/4" />
            <div className="h-2.5 bg-default-100 rounded w-1/2" />
            <div className="mt-2 pt-2 border-t border-default-100 flex items-center justify-between">
              <div className="h-2.5 bg-default-100 rounded w-6" />
              <div className="h-4 bg-default-200 rounded w-12" />
            </div>
            <div className="h-7 bg-default-100 rounded-xl w-full mt-1" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
};
