import { ReactNode } from "react";
import { useSwipeable } from "react-swipeable";

export default function BackSwipeHandler({ children }: { children: ReactNode }) {
  const handlers = useSwipeable({
    onSwipedRight: () => {
      window.history.back();
    },
    delta: 50,
    trackTouch: true,
  });
  return <div {...handlers} className="back-swipe-handler">{children}</div>;
}
