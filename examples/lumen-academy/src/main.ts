import './css/colors.css';
import './css/brands.css';
import './css/theme.css';
import './css/typography.css';
import './css/components.css';

const root = document.documentElement;
const brand = document.querySelector<HTMLSelectElement>('#brand');
const mode = document.querySelector<HTMLSelectElement>('#mode');

brand?.addEventListener('change', () => {
  root.dataset.brand = brand.value;
});

mode?.addEventListener('change', () => {
  if (mode.value === 'dark') {
    root.dataset.mode = 'dark';
  } else {
    delete root.dataset.mode;
  }
});
