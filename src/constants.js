export const ALL_US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia',
  'Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
  'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming','District of Columbia'
];

export const JOB_DOMAINS = [
  'indeed.com','linkedin.com','ziprecruiter.com','glassdoor.com','careerbuilder.com','monster.com',
  'workstream.us','careerplug.com','applicantpro.com','bamboohr.com','paylocity.com','paycomonline.net',
  'greenhouse.io','lever.co','workable.com','smartrecruiters.com','jazzhr.com','applytojob.com',
  'jobvite.com','icims.com','recruitee.com','breezy.hr','ashbyhq.com','simplyhired.com','talent.com',
  'jooble.org','jobs2careers.com','snagajob.com','adp.com','ultipro.com','dayforcehcm.com'
];

export const ROLE_FAMILIES = {
  reception: '(receptionist OR "front desk" OR "front office" OR "office coordinator")',
  customer_service: '("customer service representative" OR "customer care representative" OR CSR OR "call taker")',
  dispatch: '("service dispatcher" OR "CSR dispatcher" OR "dispatch coordinator" OR "service coordinator")',
  scheduling: '("scheduling coordinator" OR scheduler OR "appointment setter" OR "booking coordinator" OR "intake coordinator")'
};

export const TRADE_QUERIES = {
  hvac_plumbing_electrical: '(HVAC OR plumbing OR plumber OR electrician OR "electrical contractor" OR "heating and cooling")',
  exterior_construction: '(roofing OR roofer OR remodeling OR handyman OR painting OR windows OR doors OR siding OR gutters OR fencing OR concrete)',
  restoration_specialty: '(restoration OR "water damage" OR "fire damage" OR mold OR "garage door" OR locksmith OR "appliance repair" OR chimney OR solar)',
  property_services: '("pest control" OR landscaping OR "lawn care" OR "tree service" OR cleaning OR "carpet cleaning" OR pool OR irrigation OR "junk removal" OR moving OR septic)'
};

export const ROLE_TERMS = [
  'receptionist','front desk','front office','office coordinator','customer service representative',
  'customer care representative','customer service rep','csr','call taker','service dispatcher',
  'csr dispatcher','dispatch coordinator','service coordinator','scheduling coordinator','scheduler',
  'appointment setter','booking coordinator','intake coordinator','lead coordinator'
];

export const TASK_TERMS = [
  'answer incoming calls','answer inbound calls','answer phone calls','answer phones','incoming phone calls',
  'inbound calls','customer calls','schedule appointments','book appointments','schedule service',
  'dispatch technicians','dispatch service technicians','route technicians','coordinate technicians',
  'customer inquiries','service requests','appointment scheduling','call volume','missed calls'
];

export const TRADE_TERMS = [
  'hvac','heating and cooling','air conditioning','plumbing','plumber','electrical contractor','electrician',
  'roofing','roofer','restoration','water damage','fire damage','mold remediation','garage door','pest control',
  'landscaping','lawn care','tree service','pool service','cleaning service','carpet cleaning','pressure washing',
  'appliance repair','locksmith','home security','solar','remodeling','general contractor','handyman','painting',
  'windows and doors','siding','gutters','fencing','concrete','masonry','moving company','junk removal','septic',
  'irrigation','chimney','home services','service technicians','field service','service company'
];

export const EXCLUDED_CONTEXTS = [
  'medical receptionist','dental receptionist','veterinary receptionist','hotel receptionist',
  'legal receptionist','school receptionist','freight dispatcher','truck dispatcher','911 dispatcher',
  'police dispatcher','public safety dispatcher'
];
