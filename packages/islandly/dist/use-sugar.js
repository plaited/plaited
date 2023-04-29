export const sugar = {
  render({ stylesheets, content }, position) {
    const element = this;
    const template = document.createElement("template");
    template.innerHTML = [...stylesheets].join("") + content;
    if (position) {
      element.insertAdjacentElement(position, template);
      template.replaceWith(template.content);
      return element;
    }
    element.replaceChildren(template.content);
    return element;
  },
  replace({ stylesheets, content }) {
    const element = this;
    const template = document.createElement("template");
    template.innerHTML = [...stylesheets].join("") + content;
    element.replaceWith(template.content);
  },
  attr(attr, val) {
    const element = this;
    if (val === undefined) {
      return element.getAttribute(attr);
    }
    val == null
      ? element.removeAttribute(attr)
      : element.setAttribute(attr, val);
    return element;
  },
};
export const sugarForEach = {
  render(template, position) {
    const elements = this;
    elements.forEach(($el, i) => $el.render(template[i], position));
    return elements;
  },
  replace(template) {
    const elements = this;
    elements.forEach(($el, i) => $el.replace(template[i]));
    return elements;
  },
  attr(attrs, val) {
    const elements = this;
    if (typeof attrs === "string") {
      elements.forEach(($el) => $el.attr(attrs, val));
    } else {
      elements.forEach(($el) =>
        Object.entries(attrs)
          .forEach(([key, val]) => $el.attr(key, val))
      );
    }
    return elements;
  },
};
export const useSugar = (element) => {
  return Object.assign(element, sugar);
};
