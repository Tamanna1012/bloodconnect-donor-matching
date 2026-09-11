export function httpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export function assertFound(resource, resourceName = 'Resource') {
  if (!resource) {
    throw httpError(404, `${resourceName} not found`)
  }
}

// Reusable across any resource (BloodRequest today, DonorProfile etc. later):
// compares the resource's owner id against the logged-in user's id.
export function assertOwnership(resourceOwnerId, requestingUserId, resourceName = 'resource') {
  if (resourceOwnerId !== requestingUserId) {
    throw httpError(403, `You do not have permission to modify this ${resourceName}`)
  }
}
