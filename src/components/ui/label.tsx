import * as React from "react";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        className={
          "text-sm font-medium text-[#e2e8f0] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 " +
          (className || "")
        }
        ref={ref}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
