function Node(data) {
	for (key of Object.getOwnPropertyNames(data)) {
		this[key] = data[key];
	}

	this.children = this.children.map(function (childData) {
		return new Node(childData)
	});
	this._children = this.children; // d3 likes to remove empty children properties
}


// normalize nodes with one children the child itself
Node.prototype.normalizeOnlyChilds = function() {
	for (var i = 0; i < this.children.length; i++) {
		this.children[i].normalizeOnlyChilds();
		if (this.children[i].children.length == 1) {
			this.children[i] = this.children[i].children[0];
		}
	}
}

Node.prototype.getChildren = function() {
	return this._children;
};

Node.prototype.getKey = function() {
	return this.qualifiedName;
};

Node.prototype.getLeaveKeys = function(){
	if (!this._leaveKeys) {
		this._leaveKeys = this._generateLeaveKeySet();
	}
	return this._leaveKeys;
};

Node.prototype._generateLeaveKeySet = function() {
	if (!this.getChildren().length) {
		return new Set([this.getKey()]);
	}

	var result = new Set();
	for (var child of this.getChildren()) {
		for (var leaveKey of child.getLeaveKeys()) {
			result.add(leaveKey);
		}
	}
	return result;
};

Node.prototype.getNodes = function() {
	if (!this._nodes) {
		this._nodes = [ this ];
		for (var child of this.getChildren()) {
			this._nodes = this._nodes.concat(child.getNodes());
		}
	}
	return this._nodes;
};

Node.prototype.getMaxSimilarity = function(otherNode) {
	var intersection = intersect(this.getLeaveKeys(), otherNode.getLeaveKeys()).size;

	if (!intersection) {
		//console.log('short-circuit');
		// no way any node of this subtree could be similar to the other node
		return 0;
	}

	var totalCount = merge(this.getLeaveKeys(), otherNode.getLeaveKeys()).size;
	//console.log(this.getKey() + ' vs. ' + otherNode.getKey() + ': ' + intersection + ' / ' + totalCount);
	var similarity = intersection / totalCount;

	if (similarity == 1) {
		// already max
		return 1;
	}

	for (var child of otherNode.getChildren()) {
		similarity = Math.max(similarity, this.getMaxSimilarity(child))
	}
	console.log(similarity);

	return similarity;
};

function intersect(set1, set2) {
	var result = new Set();
	for (var value of set1) {
		if (set2.has(value)) {
			result.add(value);
		}
	}
	return result;
}

function merge(set1, set2) {
	var result = new Set();
	for (var value of set1) {
		result.add(value);
	}
	for (var value of set2) {
		result.add(value);
	}
	return result;
}

