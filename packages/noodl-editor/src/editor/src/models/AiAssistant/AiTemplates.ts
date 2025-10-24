import { AiNodeTemplate } from '@noodl-models/AiAssistant/interfaces';

import * as ChartTemplate from './templates/chart';
import * as FunctionTemplate from './templates/function';
import * as FunctionCrud from './templates/function-crud';
import * as FunctionQueryDatabase from './templates/function-query-database';
import * as FunctionRefactor from './templates/function-refactor';
import * as FunctionTransform from './templates/function-transform';
import * as FunctionValidate from './templates/function-validate';
import * as FunctionApi from './templates/function-api';

export const aiNodeTemplates: Record<string, AiNodeTemplate> = {
  ['function-crud']: FunctionCrud.template,
  ['function-query-database']: FunctionQueryDatabase.template,
  function: FunctionTemplate.template,
  chart: ChartTemplate.template,
  ['function-refactor']: FunctionRefactor.template,
  ['function-transform']: FunctionTransform.template,
  ['function-validate']: FunctionValidate.template,
  ['function-api']: FunctionApi.template
};
