import { IconName } from '@noodl-core-ui/components/common/Icon';

export enum PopupItemType {
  Visual = 'is-visual',
  Data = 'is-data',
  Custom = 'is-custom'
}

export type CommandMetadata = {
  title: string;
  tag: string;
  description: string;
  placeholder: string;
  type: PopupItemType;
  icon: IconName;
  examples: string[];
  availableOnFrontend: boolean;
  availableOnBackend: boolean;
  requireGPT4: boolean;
};

type CopilotCommandMetadata = CommandMetadata & {
  templateId: string;
};

export const promptToNodeCommands: CommandMetadata[] = [
  {
    title: '/UI',
    tag: 'UI Prompt',
    description: 'Create UI elements from a text prompt',
    placeholder: 'What should it be?',
    type: PopupItemType.Visual,
    icon: IconName.UI,
    availableOnFrontend: true,
    availableOnBackend: false,
    requireGPT4: true,
    examples: [
      'A login form',
      'A dropdown with values 1 to 10',
      'Landing page of a car rental company'
      // 'A vertical list with five popular car brands. Each list item should have the brand name, most popular vechicle name and type, and a button that says "view". The items should use a horizontal layout.',
      // 'Pokemon card creator form',
      // 'A group that contains two columns. First column has the text "Left column" and the other column the text "Right column". Left column is twice the size of the right one.'
    ]
  },
  {
    title: '/Image',
    tag: 'Image Prompt',
    description: 'Create an image with DALL·E 2',
    placeholder: 'How should it look?',
    type: PopupItemType.Visual,
    icon: IconName.Image,
    availableOnFrontend: true,
    availableOnBackend: false,
    requireGPT4: true,
    examples: [
      'A big, steaming bowl of noodles',
      'Four kittens with cool sunshades',
      'The worlds fastest car on holiday'
    ]
  },
  {
    title: '/Format',
    tag: 'Format Prompt',
    description: 'Improve formatting and styling of existing nodes',
    placeholder: 'How should it be formatted?',
    type: PopupItemType.Visual,
    icon: IconName.UI,
    availableOnFrontend: true,
    availableOnBackend: false,
    requireGPT4: true,
    examples: [
      'Make colors match brand theme',
      'Align all elements to grid',
      'Increase spacing between buttons',
      'Make layout more professional'
    ]
  },
  {
    title: '/Suggest',
    requireGPT4: true,
    tag: 'Suggest Prompt',
    description: 'Get suggestions for improvements',
    placeholder: 'What to get suggestions for',
    type: PopupItemType.Custom,
    icon: IconName.Question,
    availableOnFrontend: true,
    availableOnBackend: false,
    examples: ['What feature should I add next?', 'How can the form be improved?']
  }
];

export const copilotNodeInstaPromptable = ['/function', '/read from database', '/write to database', '/chart', '/refactor', '/transform', '/validate', '/api'];
export const copilotNodeCommands: CopilotCommandMetadata[] = [
  {
    requireGPT4: false,
    templateId: 'function',
    title: '/Function',
    tag: 'Function',
    description: 'Create custom JavaScript function from a text prompt',
    placeholder: 'What should it do?',
    type: PopupItemType.Custom,
    icon: IconName.Code,
    availableOnFrontend: true,
    availableOnBackend: true,
    examples: [
      'Create inputs for Array1 and Array2 and output all items with the same ID',
      'Get a random number between the min and max inputs',
      'Get the current location of the device'
    ]
  },
  {
    requireGPT4: true,
    templateId: 'function-query-database',
    title: '/Read from database',
    tag: 'Read from database',
    description: 'This will create a node that queries the database and returns the results',
    placeholder: 'What data you want?',
    type: PopupItemType.Data,
    icon: IconName.CloudDownload,
    availableOnFrontend: true,
    availableOnBackend: true,
    examples: [
      'Get all users that belong to the "Vendor" group',
      'Get all products, sort from lowest to highest price',
      'Get all unread messages for the currently logged in user'
    ]
  },
  // {
  //   templateId: 'rest',
  //   title: '/REST API',
  //   tag: 'REST',
  //   description: 'Connects to an external REST API via an HTTP from a text prompt',
  //   placeholder: 'Where and what do you want to get?',
  //   type: PopupItemType.Data,
  //   icon: IconName.RestApi,
  //   examples: [
  //     'Get the current weather at the inputs "Lat" and "Lon" from OpenWeather API',
  //     'POST Inputs.Message to the "/messages" endpoint of Inputs.APIBasePath'
  //   ]
  // },
  {
    requireGPT4: true,
    templateId: 'function-crud',
    title: '/Write to database',
    tag: 'Write to database',
    description: 'Create, read, update or delete records in the database',
    placeholder: 'What should be edited in the database?',
    type: PopupItemType.Data,
    icon: IconName.CloudUpload,
    availableOnFrontend: true,
    availableOnBackend: true,
    examples: ['Get an array of numbers, calculate the average, and save that to the current users score attribute']
  },
  {
    requireGPT4: true,
    templateId: 'chart',
    title: '/Chart',
    tag: 'Chart',
    description: 'Generate a Chart.js chart from data',
    placeholder: 'What should the chart show?',
    type: PopupItemType.Visual,
    icon: IconName.Cards,
    availableOnFrontend: true,
    availableOnBackend: false,
    examples: ['Show a bar chart of sales by month', 'Create a pie chart of user types']
  },
  {
    requireGPT4: true,
    templateId: 'function-refactor',
    title: '/Refactor',
    tag: 'Refactor',
    description: 'Improve and refactor existing function code',
    placeholder: 'How should it be improved?',
    type: PopupItemType.Custom,
    icon: IconName.Code,
    availableOnFrontend: true,
    availableOnBackend: true,
    examples: [
      'Make this more performant',
      'Add error handling',
      'Make this code more readable',
      'Simplify this logic'
    ]
  },
  {
    requireGPT4: false,
    templateId: 'function-transform',
    title: '/Transform',
    tag: 'Transform',
    description: 'Transform data from one format to another',
    placeholder: 'What transformation?',
    type: PopupItemType.Data,
    icon: IconName.Code,
    availableOnFrontend: true,
    availableOnBackend: true,
    examples: [
      'Convert array to object keyed by ID',
      'Flatten nested data',
      'Extract specific fields from objects',
      'Filter and map user data'
    ]
  },
  {
    requireGPT4: false,
    templateId: 'function-validate',
    title: '/Validate',
    tag: 'Validate',
    description: 'Create validation logic for forms and data',
    placeholder: 'What should be validated?',
    type: PopupItemType.Custom,
    icon: IconName.Code,
    availableOnFrontend: true,
    availableOnBackend: true,
    examples: [
      'Validate email format',
      'Check password is at least 8 characters',
      'Ensure phone number is valid',
      'Validate required fields are filled'
    ]
  },
  {
    requireGPT4: true,
    templateId: 'function-api',
    title: '/API',
    tag: 'API',
    description: 'Configure REST API call with proper formatting',
    placeholder: 'Which API to call?',
    type: PopupItemType.Data,
    icon: IconName.RestApi,
    availableOnFrontend: true,
    availableOnBackend: true,
    examples: [
      'Get weather from OpenWeather API for lat/lon inputs',
      'POST message to Slack webhook',
      'Fetch user data from custom API',
      'Call Stripe API to create payment'
    ]
  }
];

export const comingSoonCommands: CommandMetadata[] = [];
