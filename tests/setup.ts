// Shared test setup. Tests on the fake backend (PGlite) are slower on a busy CI runner, so Testing
// Library's findBy*/waitFor wait longer than their 1 s default; a passing test is not slowed down.
import { configure } from '@testing-library/dom';

configure({ asyncUtilTimeout: 10000 });
