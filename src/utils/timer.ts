export default function (name: string) {
  let t0: number;

  const start = () => {
    t0 = performance.now();
  };

  const measure = (label: string) => {
    const t1 = performance.now();
    console.log(`[timer] ${name}: ${label}: ${t1 - t0}ms`);
    t0 = t1;
  };

  return { start, measure };
}
