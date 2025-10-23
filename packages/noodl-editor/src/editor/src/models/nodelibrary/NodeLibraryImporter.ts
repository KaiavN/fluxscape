import { difference } from 'underscore';

import { NodeLibrary } from '@noodl-models/nodelibrary/nodelibrary';
import {
  NodeLibraryData,
  NodeLibraryDataNodeType,
  RuntimeType,
  RuntimeTypes
} from '@noodl-models/nodelibrary/NodeLibraryData';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { CategorizedComponent } from '../utils/ComponentCategorizer';

/**
 * Keep track of all the clients and their nodes.
 *
 * This is so we can make sure we always give the user the correct information
 * on what nodes are available to them.
 *
 * Because the viewers can connect/disconnect at any times, we keep a cache around to.
 * So when you get all the node names you will always get for all kinds of viewers runtimes.
 */
class ClientCollection {
  // NOTE: Made public for labbing with ConnectionInspector
  public _clients: {
    [clientId: string]: {
      runtimeTypes: Set<RuntimeType>;
      nodes: Set<string>;
    };
  } = {};

  private _cache: {
    [key: string]: Set<string>;
  } = {};

  public get count(): number {
    return Object.keys(this._clients).length;
  }

  public getNodeNames() {
    const taken = new Set<RuntimeType>();

    // Get all the nodes of the viewers we have
    let nodes = Object.entries(this._clients).flatMap(([_clientId, item]) => {
      item.runtimeTypes.forEach((runtimeType) => taken.add(runtimeType));
      return [...item.nodes];
    });

    // Check if we are missing any runtime types
    if (taken.size !== RuntimeTypes.length) {
      const missing = difference(RuntimeTypes, Array.from(taken.keys()));
      missing.forEach((runtimeType) => {
        if (this._cache[runtimeType]) {
          nodes = nodes.concat(Array.from(this._cache[runtimeType].keys()));
        } else {
          // console.error('[nodelib] Missing runtime type: ', runtimeType);
        }
      });
    }

    return new Set<string>(nodes);
  }

  public import(clientId: string, runtimeType: RuntimeType, nodetypes: NodeLibraryDataNodeType[]): void {
    if (!this._clients[clientId]) {
      this._clients[clientId] = {
        runtimeTypes: new Set(),
        nodes: new Set()
      };
    }

    this._clients[clientId].runtimeTypes.add(runtimeType);

    // Update the node set
    this._clients[clientId].nodes.clear();
    nodetypes.forEach((node) => {
      this._clients[clientId].nodes.add(node.name);
    });

    this._cache[runtimeType] = this._clients[clientId].nodes;
  }

  public remove(clientId: string) {
    delete this._clients[clientId];
  }

  public clear() {
    this._clients = {};
    this._cache = {};
  }
}

/**
 * Handle merging of node libraries between different runtimes.
 */
export class NodeLibraryImporter {
  public static instance = new NodeLibraryImporter();

  private currentNodeLibrary: NodeLibraryData = null;
  private clients = new ClientCollection();

  constructor() {
    EventDispatcher.instance.on(
      'ProjectModel.instanceWillChange',
      () => {
        this.clients.clear();
        this.currentNodeLibrary = null;
      },
      this
    );
  }

  // NOTE: Made for labbing with ConnectionInspector
  public clientsWithRuntime(runtimeType: RuntimeType): string[] {
    return Object.keys(this.clients._clients).filter((key) => this.clients._clients[key].runtimeTypes.has(runtimeType));
  }

  public clear() {
    console.debug('[nodelib] Clear');

    this.clients.clear();
    this.currentNodeLibrary = null;
  }

  /**
   * Occurs when the client is disconnecting.
   *
   * @param clientId
   */
  public onClientDisconnect(clientId: string) {
    this.clients.remove(clientId);
    this.updateIndex(false);
  }

  /**
   * Occurs when the client is sending their node library.
   *
   * @param clientId
   * @param runtimeType
   * @param library
   * @returns
   */
  public onClientImport(clientId: string, runtimeType: RuntimeType, library: NodeLibraryData): void {
    this.clients.import(clientId, runtimeType, library.nodetypes);

    console.debug('[nodelib] Received', runtimeType, ` (nodes: ${library.nodetypes.length})`);

    // Assign or update the new library into our current version.
    let updated = false;
    if (!this.currentNodeLibrary) {
      this.assignNewLibrary(runtimeType, library);
      updated = true;
    } else {
      if (this.mergeUpdates(runtimeType, library)) {
        updated = true;
      }
    }

    this.updateIndex(updated);
  }

  private updateIndex(forceUpdate: boolean): void {
    if (!this.currentNodeLibrary) {
      // @ts-ignore
      window.NodeLibraryData = {};
      return;
    }

    const nodeNames = this.clients.getNodeNames();

    // Remove all the nodes that we don't have anymore
    const removedNodes = [];
    this.currentNodeLibrary.nodetypes = this.currentNodeLibrary.nodetypes.filter((node) => {
      if (!nodeNames.has(node.name)) {
        removedNodes.push(node);
        return false;
      }
      return true;
    });

    if (forceUpdate || removedNodes.length > 0) {
      // Send the node library to our NodeLibrary
      const exportJSON = JSON.parse(JSON.stringify(this.currentNodeLibrary));

      // @ts-ignore
      window.NodeLibraryData = exportJSON;

      if (this.clients.count >= 2) {
        console.debug('[nodelib] Loaded new node library');
        if (removedNodes.length > 0) console.debug('[nodelib] Removed nodes: ', removedNodes);
        NodeLibrary.instance.reload();
      }
    }
  }

  private assignNewLibrary(runtimeType: RuntimeType, library: NodeLibraryData) {
    // Use the new library if we have none already.
    this.currentNodeLibrary = library;

    // Add what runtime the nodes are from.
    this.currentNodeLibrary.nodetypes.forEach((node) => {
      node.runtimeTypes = [runtimeType];
    });

    // Make sure the data structure is what we expect
    if (!this.currentNodeLibrary.nodeIndex.coreNodes) {
      this.currentNodeLibrary.nodeIndex.coreNodes = [];
    }

    if (!this.currentNodeLibrary.nodeIndex.moduleNodes) {
      this.currentNodeLibrary.nodeIndex.moduleNodes = [];
    }
  }

  private mergeUpdates(runtimeType: RuntimeType, library: NodeLibraryData): boolean {
    let updated = false;

    // Loop over all the new node types
    library.nodetypes.forEach((node) => {
      const index = this.currentNodeLibrary.nodetypes.findIndex((x) => node.name === x.name);
      if (index === -1) {
        // Add the node, if it doesnt exist with the correct runtime
        node.runtimeTypes = [runtimeType];
        this.currentNodeLibrary.nodetypes.push(node);
        updated = true;
      } else {
        // TODO: Update the node data?

        // Create the array if it doesnt exist
        if (!this.currentNodeLibrary.nodetypes[index].runtimeTypes) {
          this.currentNodeLibrary.nodetypes[index].runtimeTypes = [];
        }

        // Insert the new runtime if we dont have it.
        if (!this.currentNodeLibrary.nodetypes[index].runtimeTypes.includes(runtimeType)) {
          this.currentNodeLibrary.nodetypes[index].runtimeTypes.push(runtimeType);
          updated = true;
        }
      }
    });

    // Merge replace by name function
    function mergeInByName(inputArray: { name: string }[], outputArray: { name: string }[]) {
      inputArray.forEach((inputItem) => {
        const index = outputArray.findIndex((_t) => inputItem.name === _t.name);
        if (index !== -1) {
          outputArray[index] = inputItem;
        } else {
          outputArray.push(inputItem);
          updated = true;
        }
      });

      // if (inputArray.length > 0) {
      //   updated = true;
      // }
    }

    if (library.nodeIndex.coreNodes) {
      mergeInByName(library.nodeIndex.coreNodes, this.currentNodeLibrary.nodeIndex.coreNodes);
    }

    if (library.nodeIndex.moduleNodes) {
      mergeInByName(library.nodeIndex.moduleNodes, this.currentNodeLibrary.nodeIndex.moduleNodes);
    }

    // do the same for project settings ports
    mergeInByName(library.projectsettings.ports, this.currentNodeLibrary.projectsettings.ports);
    mergeInByName(library.projectsettings.dynamicports, this.currentNodeLibrary.projectsettings.dynamicports);

    return updated;
  }

  /**
   * Register npm-imported components into node library
   * 
   * @param components - Array of categorized components from npm packages
   */
  public registerNpmComponents(components: CategorizedComponent[]): void {
    if (!this.currentNodeLibrary) {
      console.warn('[nodelib] Cannot register npm components: no current node library');
      return;
    }

    console.debug('[nodelib] Registering npm components:', components.length);

    let added = 0;
    const existingNames = new Set(this.currentNodeLibrary.nodetypes.map(n => n.name));

    components.forEach((categorized) => {
      const component = categorized.component;
      
      // Generate unique node name
      let nodeName = `npm.${component.packageName}.${component.name}`;
      let displayName = component.name;

      // Handle collision - check if component with same display name exists
      const existingWithSameName = this.currentNodeLibrary.nodetypes.find(
        n => n.displayName === displayName && !n.name.startsWith('npm.')
      );

      if (existingWithSameName) {
        // Append package name to display name for disambiguation
        displayName = `${component.name} (${categorized.subcategory})`;
      }

      // Skip if already exists (same package version)
      if (existingNames.has(nodeName)) {
        console.debug(`[nodelib] Skipping duplicate: ${nodeName}`);
        return;
      }

      // Create node type entry
      const nodeType: NodeLibraryDataNodeType = {
        name: nodeName,
        displayName: displayName,
        category: categorized.category,
        subCategory: categorized.subcategory,
        color: 'component',
        docs: `Imported from ${component.packageName}@${component.packageVersion}`,
        dynamicports: [],
        panel: {},
        runtimeTypes: ['react'],
        metadata: {
          npmPackage: component.packageName,
          npmVersion: component.packageVersion,
          exportPath: component.exportPath,
          exportType: component.exportType
        }
      };

      // Add to nodetypes array
      this.currentNodeLibrary.nodetypes.push(nodeType);
      existingNames.add(nodeName);

      // Add to module nodes index
      if (!this.currentNodeLibrary.nodeIndex.moduleNodes) {
        this.currentNodeLibrary.nodeIndex.moduleNodes = [];
      }

      this.currentNodeLibrary.nodeIndex.moduleNodes.push({
        name: nodeName
      });

      added++;
    });

    console.debug(`[nodelib] Added ${added} npm components`);

    // Update the node library to refresh UI
    if (added > 0) {
      this.updateIndex(true);
    }
  }

  /**
   * Remove all components from an npm package
   * 
   * @param packageName - Name of npm package to remove
   */
  public removeNpmPackage(packageName: string): void {
    if (!this.currentNodeLibrary) {
      return;
    }

    console.debug('[nodelib] Removing npm package:', packageName);

    // Filter out nodes from this package
    const prefix = `npm.${packageName}.`;
    const originalCount = this.currentNodeLibrary.nodetypes.length;

    this.currentNodeLibrary.nodetypes = this.currentNodeLibrary.nodetypes.filter(
      node => !node.name.startsWith(prefix)
    );

    // Also remove from module nodes index
    if (this.currentNodeLibrary.nodeIndex.moduleNodes) {
      this.currentNodeLibrary.nodeIndex.moduleNodes = 
        this.currentNodeLibrary.nodeIndex.moduleNodes.filter(
          node => !node.name.startsWith(prefix)
        );
    }

    const removed = originalCount - this.currentNodeLibrary.nodetypes.length;
    console.debug(`[nodelib] Removed ${removed} components from ${packageName}`);

    // Update UI if anything was removed
    if (removed > 0) {
      this.updateIndex(true);
    }
  }
}
