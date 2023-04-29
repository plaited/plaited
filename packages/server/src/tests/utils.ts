export const __dirname = new URL(".", import.meta.url).pathname;
export const root = `${__dirname}/assets`;

export const ssr = (html: string) => {
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};

export const home = '<link rel="stylesheet" href="./styles.css"><h1>Home</h1>';
export const help =
  '<link rel="stylesheet" href="./new-styles.css"><h1>Help</h1>';
export const homeHandler = () => ssr(home);

export const helpHandler = () => ssr(help);

export const newStyles = `
body {
  color: rebeccapurple;
  font-size: 12px;
}
`;
