export const templates = [
  {
    id: 'blank',
    name: 'Blank Flow',
    description: 'Start from scratch with a single trigger.',
    icon: 'Plus',
    nodes: [
      { id: 'start', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Start Trigger' } }
    ],
    edges: []
  },
  {
    id: 'welcome',
    name: 'Welcome Message',
    description: 'Greet new users and introduce your bot.',
    icon: 'MessageSquare',
    nodes: [
      { id: 'start', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Start Trigger' } },
      { id: 'msg-1', type: 'message', position: { x: 250, y: 150 }, data: { label: 'Hi there! Welcome to our bot. 👋' } },
      { id: 'msg-2', type: 'message', position: { x: 250, y: 250 }, data: { label: 'How can we help you today?' } }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'msg-1' },
      { id: 'e2', source: 'msg-1', target: 'msg-2' }
    ]
  },
  {
    id: 'lead-gen',
    name: 'Lead Generation',
    description: 'Collect user email and qualify leads.',
    icon: 'UserPlus',
    nodes: [
      { id: 'start', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Start Trigger' } },
      { id: 'msg-1', type: 'message', position: { x: 250, y: 150 }, data: { label: 'Hi! Interested in our exclusive guide?' } },
      { id: 'input-1', type: 'input', position: { x: 250, y: 250 }, data: { label: 'Please type "yes" to continue.' } },
      { id: 'cond-1', type: 'condition', position: { x: 250, y: 350 }, data: { label: 'yes' } },
      { id: 'msg-yes', type: 'message', position: { x: 100, y: 450 }, data: { label: 'Great! What is your email address?' } },
      { id: 'input-email', type: 'input', position: { x: 100, y: 550 }, data: { label: 'Type your email below:' } },
      { id: 'msg-thanks', type: 'message', position: { x: 100, y: 650 }, data: { label: 'Thanks! We sent it to your inbox.' } },
      { id: 'msg-no', type: 'message', position: { x: 400, y: 450 }, data: { label: 'No problem! Let us know if you change your mind.' } }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'msg-1' },
      { id: 'e2', source: 'msg-1', target: 'input-1' },
      { id: 'e3', source: 'input-1', target: 'cond-1' },
      { id: 'e4', source: 'cond-1', sourceHandle: 'true', target: 'msg-yes' },
      { id: 'e5', source: 'cond-1', sourceHandle: 'false', target: 'msg-no' },
      { id: 'e6', source: 'msg-yes', target: 'input-email' },
      { id: 'e7', source: 'input-email', target: 'msg-thanks' }
    ]
  },
  {
    id: 'support',
    name: 'Customer Support',
    description: 'Route support queries effectively.',
    icon: 'Headphones',
    nodes: [
      { id: 'start', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Start Trigger' } },
      { id: 'msg-1', type: 'message', position: { x: 250, y: 150 }, data: { label: 'Welcome to Support! How can we help?' } },
      { id: 'input-1', type: 'input', position: { x: 250, y: 250 }, data: { label: 'Reply "order" for status or "agent" for help.' } },
      { id: 'cond-order', type: 'condition', position: { x: 150, y: 350 }, data: { label: 'order' } },
      { id: 'msg-order', type: 'message', position: { x: 50, y: 450 }, data: { label: 'Please provide your Order ID.' } },
      { id: 'cond-agent', type: 'condition', position: { x: 350, y: 350 }, data: { label: 'agent' } },
      { id: 'msg-agent', type: 'message', position: { x: 350, y: 450 }, data: { label: 'Connecting you to an agent...' } }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'msg-1' },
      { id: 'e2', source: 'msg-1', target: 'input-1' },
      { id: 'e3', source: 'input-1', target: 'cond-order' },
      { id: 'e4', source: 'cond-order', sourceHandle: 'true', target: 'msg-order' },
      { id: 'e5', source: 'cond-order', sourceHandle: 'false', target: 'cond-agent' },
      { id: 'e6', source: 'cond-agent', sourceHandle: 'true', target: 'msg-agent' }
    ]
  }
];
