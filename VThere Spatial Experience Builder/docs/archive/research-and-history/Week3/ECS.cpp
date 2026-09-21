/******************************************************************************/
/*!
\group  	CtrlAlt
\file		Engine.h
\author 	Michael Lazaroo
\par    	m.lazaroo@digipen.edu
\date   	Sep 08, 2024
\brief

This file contains the implementation and interface of the ECS 
(Entity Component System) architecture. The ECS is a design pattern
that allows for the separation of data and logic in a game engine.
They are seperated by components, entities, and systems.

Components are just pure data,
Entities are just IDs,
Systems are logics that operate on entities with specific components.

Copyright (C) 2024 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
#include "../src/pch.h"
#include "ECS.h"
#include "../Application/App.h"

class ECS::Registry* ECS::Entity::static_registry = nullptr;


namespace ECS
{

	ComponentID InterfaceComponent::componentID = 0;

	///Entity Implementation
	///=========================================================================================================

	Entity Entity::GetEntity(int entity_id)
	{
		UNREFERENCED_PARAMETER(entity_id);
		/*
		// TESTING with entity id.
		ECS::Entity HELLO(0);
		HELLO = HELLO.GetEntity(0);
		auto& Tcomp = HELLO.GetComponent<Component::CTransform>();
		*/
		// This implementation is too bad to be used, I am sorry , allow me to repent for my sins
		this->registry = static_registry;
		return *this;
	}

	/**
	* @brief Marks the entity for deletion from the registry
	*
	* Requests the registry to remove this entity and its associated components
	*/
	void Entity::Kill()
	{
		registry->KillEntity(*this);
	}

	/**
	 * @brief Sets the name of the entity
	 * @param name The string to set as the entity's name
	 */
	void Entity::SetName(const std::string& name) const
	{
		registry->NameEntity(*this, name);
	}

	/**
	 * @brief Checks if the entity has a specific name
	 * @param tag The name to check against
	 * @return true if the entity has the specified name, false otherwise
	 */
	bool Entity::HasName(const std::string& tag) const
	{
		return registry->EntityHasName(*this, tag);
	}

	/**
	 * @brief Adds a tag to the entity
	 * @param tag The tag to associate with the entity
	 */
	void Entity::Tag(const std::string& tag) const
	{
		registry->TagEntity(*this, tag);
	}

	/**
	 * @brief Retrieves the name of the entity
	 * @return The entity's name as a string
	 */
	std::string Entity::GetName() const
	{
		return registry->GetEntityName(*this);
	}

	/**
	 * @brief Checks if the entity belongs to a specific tag group
	 * @param tag The tag to check against
	 * @return true if the entity belongs to the specified tag group, false otherwise
	 */
	bool Entity::BelongsToTag(const std::string& tag) const {
		return registry->EntityBelongsToTag(*this, tag);
	}

	///System Implementation
	///=========================================================================================================


	/**
	 * \brief
	 * Adds an entity to the system
	 * \param entity
	 * \return void
	 * \details
	 * Adds an entity to the system
	 */
	void System::AddEntity(Entity entity) {
		auto it = std::find_if(entities.begin(), entities.end(),
			[entity](Entity e) { return e == entity; });
		if (it == entities.end())
			entities.push_back(entity);
		else
			*it = entity;
	}

	/**
	 * \brief
	 * Removes an entity from the system
	 * \param entity
	 * \return void
	 * \details
	 * Removes an entity from the system using erase remove idiom
	 */
	void System::RemoveEntity(Entity entity) {
		entities.erase(std::remove_if
		(entities.begin(),
			entities.end(),
			[&](Entity e) { return e == entity; }),
			entities.end());
	}
	 /**
	  * \brief
	  * Clears the entities from the system
	  * \return void
	  */
	void System::ClearEntities()
	{
		entities.clear();
	}

	/**
	 * \brief
	 * Returns the entities in the system
	 * \param 
	 * \return std::vector<Entity>
	 * \details
	 * Returns the entities in the system
	 * 
	 */
	std::vector<Entity> System::GetEntities() const {
		return entities;
	}

	/*
	@brief Checks if an entity exists in the system
	@param entity The entity to check for
	@return bool True if the entity exists in the system
	*/
	bool System::EntityExists(Entity entity) const {
		return std::find(entities.begin(), entities.end(), entity) != entities.end();
	}

	/*
	@brief Swaps the position of two entities in the system
	@param entity1 The first entity to swap
	@param entity2 The second entity to swap
	*/
	bool System::SwapEntitiesPosition(Entity entity1, Entity entity2)
	{
		auto it_1 = std::find(std::begin(entities), std::end(entities), entity1);
		if (it_1 == entities.end())
			return false;

		auto it_2 = std::find(std::begin(entities), std::end(entities), entity2);
		if (it_2 == entities.end())
			return false;

		std::swap(*it_1, *it_2);
		return true;

	}

	/**
	 * 
	 * \brief
	 * Returns the component mask of the system
	 * \param
	 * \return const ComponentMask&
	 * \details
	 * Returns the component mask of the system,
	 * which is used to determine if an entity can be added to the system
	 */
	const ComponentMask& System::GetComponentMask() const {
		return componentMask;
	}

	///Component Implementation
	///=========================================================================================================


	///Registry Implementation
	///=========================================================================================================
	/**
	 * @brief Creates a new entity in the Entity Component System (ECS).
	 * 
	 * @details This function is responsible for creating and initializing a new entity.
	 * It performs the following steps:
	 * 1. Attempts to reuse an ID from the pool of free IDs.
	 * 2. If no free IDs are available, it increments the total entity count.
	 * 3. Resizes the component mask vector if necessary to accommodate the new entity.
	 * 4. Initializes a new Entity object with the assigned ID.
	 * 5. Adds the new entity to the addition queue for processing in the next update cycle.
	 * 
	 * @note This function does not immediately add the entity to systems. The actual
	 * system integration occurs during the next call to Update().
	 * 
	 * @see Update(), KillEntity()
	 * 
	 * @return Entity A newly created Entity object with a unique ID.
	 */
	Entity Registry::CreateEntity()
	{
		EntityID entityId;
		if (freeIDs.empty())
		{
			entityId = numEntities++;
			Logger::LogInfo("Num entities: " + std::to_string(numEntities));
			if (entityId >= entityComponentMasks.size())
			{
				entityComponentMasks.resize(entityId + 1);
			}
		}
		else
		{
			entityId = freeIDs.front();
			freeIDs.pop_front();
		}

		Entity entity(static_cast<int>(entityId));
		entity.registry = this;
		std::string message{ "Entity created with ID: " + std::to_string(entityId) };
		Logger::LogInfo(message);
		//entitiesAddQueue.insert(entity);

		return entity;
	}

	/**
	 * @brief Marks an entity for removal from the ECS.
	 * 
	 * @details This function initiates the entity removal process by:
	 * 1. Adding the specified entity to the removal queue.
	 * 2. Logging the removal action for debugging purposes.
	 * 
	 * The entity is not immediately removed from systems or component pools.
	 * Instead, it's queued for removal, which will be processed during the next
	 * call to Update().
	 * 
	 * @note Calling this function does not immediately invalidate the entity or
	 * its components. They remain accessible until the next update cycle.
	 * 
	 * @param entity The Entity object to be marked for removal.
	 * 
	 * @see Update(), CreateEntity()
	 */
	void Registry::KillEntity(Entity entity)
	{
		entitiesRemoveQueue.insert(entity);
		Logger::LogInfo("Entity " + std::to_string(entity.GetID()) + " was Killed");
	}

	/**
	 * @brief Performs a complete reset of the ECS through the registry. All
	 * entities synthesized will be culled and removed.
	 * 
	 * @details This function adds a new system to the ECS registry. The system is
	 * stored in a map using its type as the key. The system is also initialized with
	 * a reference to the ECS registry.
	 * 
	 * @note Calling this function will overwrite the system completely remove entities
	 * it's associated component signature masks.
	 * 
	 * @param 
	 */
	void Registry::ClearEntities()
	{
		componentPools.clear();

		for (auto& system : systems)
		{
			system.second->ClearEntities();
		}

		freeIDs.clear();
		namePerEntity.clear();
		entityPerName.clear();
		entitiesAddQueue.clear();
		entitiesRemoveQueue.clear();
		entityComponentMasks.clear();
		numEntities = 0;
	}

	/*
	@brief returns the hash map of systems
	*/
	SystemsHashmap const& Registry::GetSystems() const
	{
		return systems;
	}

	/**
	 * @brief Registers a new entity to the ECS current system.
	 * 
	 * @details This function does the following operations:
	 * 1. Retrieves the component's ID and component mask.
	 * 2. Iterates through all the systems
	 * 3. Checks within each component mask of the entity
	 * and checks with the system's component mask
	 * 4. If the entity meets the requirement's, it's added to the system.
	 * 
	 * This process is integral to the ECS' architecture as it allows for
	 * dynamic system integration based on the entity's component signature.
	 * 
	 * @param entity The entity to be registered to the ECS.
	 * 
	 * @see RemoveEntityFromSystems()
	 */
	void Registry::AddEntityToSystems(Entity entity)
	{
		const auto entityID = entity.GetID();
		Logger::LogInfo("Created Entity of " + std::to_string(entityID));
	
		const auto& entityComponentMask = entityComponentMasks[entityID];

		for (auto& system : systems)
		{
			const auto& systemComponentMask = system.second->System::GetComponentMask();
			bool fitsRequirements = (entityComponentMask & systemComponentMask) == systemComponentMask;
			if (fitsRequirements)
			{
				if(!system.second->EntityExists(entity))
				system.second->AddEntity(entity);
			}
		}
	}	
	/**
	 * @brief Retrieves the name associated with an entity
	 * @param entity The entity whose name should be retrieved
	 * @return The name of the entity if it has one, empty string otherwise
	 */
	std::string Registry::GetEntityName(Entity entity) const {
		auto it = namePerEntity.find(entity.GetID());
		if (it != namePerEntity.end()) {
			return it->second;
		}
		return "";
	}
	/**
	 * @brief Assigns a name to an entity
	 * @param entity The entity to be named
	 * @param name The name to assign to the entity
	 * @note This will create mappings in both direction between entity and name
	 */
	void Registry::NameEntity(Entity entity, const std::string& name)
	{
		entityPerName.emplace(name, entity);
		namePerEntity[entity.GetID()] = name;
	}

	/**
	* @brief Checks if an entity has a name
	* @param entity The entity to check
	* @param name The name to check
	* @return True if the entity has the name, false otherwise
	*/
	bool Registry::EntityHasName(Entity entity, const std::string& name) const
	{
		if (namePerEntity.find(entity.GetID()) == namePerEntity.end())
		{
			return false;
		}
		return entityPerName.find(name)->second == entity;
	}

	/**
	* @brief Retrieves an entity by name
	* @param name The name of the entity to retrieve
	* @return The entity with the given name if it exists, otherwise an invalid entity
	*/
	Entity Registry::GetEntityByName(const std::string& name) const {
		auto it = entityPerName.find(name);
		if (it != entityPerName.end()) {
			return it->second;
		}
		return 0;
	}

	/*
	* @brief Removes the entity name mapping
	* @param entity The entity to remove the name from
	* @note This will remove the mappings in both directions
	*/
	void Registry::RemoveEntityName(Entity entity)
	{
		auto entityName = namePerEntity.find(entity.GetID());
		if (entityName != namePerEntity.end())
		{
			auto name = entityName->second;
			entityPerName.erase(name);
			namePerEntity.erase(entityName);
		}
	}
	/*
	@brief Assigns a tag to an entity
	@param entity The entity to be tagged
	@param group The tag to assign to the entity
	@note This will create mappings in both direction between entity and tag
	*/
	void Registry::TagEntity(Entity entity, const std::string& group) {
		entityPerTag.emplace(group, std::set<Entity>());
		entityPerTag[group].emplace(entity);
		tagPerEntity.emplace(entity.GetID(), group);
	}

	/*
	@brief Check if entity belongs to a tag
	@param entity The entity to check
	@param group The tag to check
	@return True if the entity belongs to the tag, false otherwise
	*/
	bool Registry::EntityBelongsToTag(Entity entity, const std::string& group) const {
		auto groupEntities = entityPerTag.at(group);
		return groupEntities.find(entity.GetID()) != groupEntities.end();
	}
	/*
	* @brief Retrieves all entities with a given tag
	* @param group The tag to retrieve entities for
	* @return A vector of entities with the given tag
	*/
	std::vector<Entity> Registry::GetEntitiesByTag(const std::string& group) const {
		auto& setOfEntities = entityPerTag.at(group);
		return std::vector<Entity>(setOfEntities.begin(), setOfEntities.end());
	}

	/*
	@brief Removes the entity from the tag mapping
	@param entity The entity to remove from the tag
	@note This will remove the mappings in both directions
	*/

	void Registry::RemoveEntityInTag(Entity entity) {
		// if in group, remove entity from group management
		auto groupedEntity = tagPerEntity.find(entity.GetID());
		if (groupedEntity != tagPerEntity.end()) {
			auto group = entityPerTag.find(groupedEntity->second);
			if (group != entityPerTag.end()) {
				auto entityInGroup = group->second.find(entity);
				if (entityInGroup != group->second.end()) {
					group->second.erase(entityInGroup);
				}
			}
			tagPerEntity.erase(groupedEntity);
		}
	}

	/*
	@brief Retrieves the tag associated with an entity
	@param entity The entity whose tag should be retrieved
	@return The tag of the entity if it has one, empty string otherwise
	*/

	void Registry::UpdateComponentInSystems(Entity entity)
	{
		const auto entityID = entity.GetID();
		const auto& entityComponentMask = entityComponentMasks[entityID];

		for (auto& system : systems)
		{
			const auto& systemComponentMask = system.second->GetComponentMask();
			bool fitsRequirements = (entityComponentMask & systemComponentMask) == systemComponentMask;
			bool existsInSystem = system.second->EntityExists(entity);
			if (fitsRequirements && !existsInSystem)
			{
				system.second->AddEntity(entity);

			}
			else if(!fitsRequirements && existsInSystem)
			{
				system.second->RemoveEntity(entity);
			}
		}
	}

	/**
	 * @brief
	 * Removes an entity from all systems in the ECS.
	 * 
	 * @details 
	 * Iterates through all the systems and removes the specified entity. This is 
	 * integral to entity removal or when an entity potentially has it's component
	 * signature changed drastically.
	 * 
	 * @note
	 * This function does not remove the entity from the ECS. The function still has
	 * the entity's component signature in the entityComponentMasks vector.
	 * 
	 * @see RemoveEntity()
	 */
	void Registry::RemoveEntityFromSystems(Entity entity)
	{
		for (auto& system : systems)
		{
			system.second->RemoveEntity(entity);
		}
	}

	/**
	 * @brief
	 * Updates the ECS registry
	 * 
	 * @details
	 * This function does:
	 * 1. Goes through the entities in the add queue and adds them to the systems
	 * 2. Clears the add queue
	 * 3. Goes through the entities in the remove queue and removes them from the systems
	 * 4. Clears the entities in the remove queue
	 * 
	 * @note 
	 * This function is called every frame to update the ECS registry.
	 * This function will RESET the component mask of an entity but not remove it from the ECS.
	 * 
	 * @see AddEntityToSystems(), RemoveEntityFromSystems()
	 */
	void Registry::Update()
	{
		for (auto& entity : entitiesAddQueue)
		{
			AddEntityToSystems(entity);
		}

		for (auto& entity : entitiesEditQueue)
		{
			UpdateComponentInSystems(entity);
		}

		entitiesAddQueue.clear();
		entitiesEditQueue.clear();

		for (auto& entity : entitiesRemoveQueue)
		{
			RemoveEntityFromSystems(entity);
			entityComponentMasks[entity.GetID()].reset();

			Global::engineMonoScript->RemoveMonoObject(entity); 

			for(auto pool: componentPools)
			{
				if (pool) {
					pool->RemoveEntityFromPool(entity.GetID());
				}
			}

			freeIDs.push_back(entity.GetID());
			RemoveEntityName(entity);
			RemoveEntityInTag(entity);
		}
		entitiesRemoveQueue.clear();
	}

}

