/******************************************************************************/
/*!
\group  	CtrlAlt
\file		SLogic.cpp
\author 	Sherman Goh Wee Hao
\par    	shermanweehao.goh@digipen.edu
\date   	Oct 19, 2024 [week 8]
\date   	Nov 22, 2024 [week 12] Revamp for C#.
\brief		This is SLogic to hand and help Entities run their Logic in the
			game update loop.

\par
		Cannot complete description/documentation in time ,
		Can look into M2 Rubrics for some explanation.

		reference
		https://buildagameengine.com/scripting/scripts-and-components-mono


\note
		=========
		M3 Update
		=========
		just something, When we Setup the Entity, we are asking mono to make
		an instance of the C# Script Class.
		This means that the runtime of that object will remain as long as
		our C++ side is holding on that MonoObject.

		So it is important to know where is your MonoObject of that instance 
		as that is the instance lol.


Copyright (C) 2024 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
 /******************************************************************************/
#include "../src/pch.h"
#include "./SLogic.h"
#include "../Components/CScriptMono.h"

#include "../Engine/Engine.h"
#include "../Application/App.h"



namespace System
{

	SLogic::SLogic(EngineMonoScript* _scriptEngine) 
		: scriptEngine(_scriptEngine)
	{
		// nothing to initialise.
		// need to set the component mask.
		this->RequireComponent<Component::CMonoScript>(); 
		// don't know what musk I am suppose to have.
		// but the scripts can do its own safety check?

	}

	void SLogic::Setup() // w engine // I add BehaviourFCT in here. // so most likely I will add in all the header files . 
	{  
		// what does the setup do ?
		// It would be in the editor interface where you know what script it has and the vars in it.
			// update, Yes I have done this and it would also send the vars data at start up.
		// I may need to recall the Vars sending to the MonoClass .
		auto entityList = this->GetEntities();

		for (ECS::Entity entity : entityList)
		{
			auto& monoComp = entity.GetComponent<Component::CMonoScript>();
			// Sherman: PROBLEM 3 who will attach the m_object to the component?
			// it is done in the Setup. I need the entity. I need to send in the entity.
			//monoComp.m_object->localObject = &entity; // wants  to know itself. // should be okay getting the address?

			monoComp.Setup(monoComp.className, this->scriptEngine, entity); 
			//monoComp.ConstructEntity(); // it is either this or SetupEntity //PRE M4 RELIC
			std::string message = entity.GetName() + " has this script class " + monoComp.className;
			Logger::LogInfo(message);

		}

	}
		// how can I make this data driven? lol . probably with scripts.  
	void SLogic::Init() // w game simulation
	{
		auto entityList = this->GetEntities(); 
		// this should be data driven.
		// probably Entity holding the Cbehaviour will just be fine.

		for (ECS::Entity& entity : entityList)
		{
			auto& monoComp = entity.GetComponent<Component::CMonoScript>();
			monoComp.Initialize();
			// CMonoScript has the className and monoClass.
			// I would need to attach the entity (itself) and MonoObject(remoteeobject)
			// Sherman: CRITICAL : when Deserialising, I attach the entity to the CMonoScript.
						// or Engine/Scene need to re setup the Scripts ( when "reloading" ).

		}
		

	}

	void SLogic::Update()
	{	
		for (auto& entity : GetEntities())
		{
			if (entity.HasComponent<Component::CMonoScript>())
			{
				auto& monoComp = entity.GetComponent<Component::CMonoScript>(); 

				if (!monoComp.active)
				{
					Logger::LogInfo("==========\n aha! \n===========");
					continue; // to skip
				}
				if (monoComp.m_object != nullptr)
					monoComp.Update((float)Global::engineGame->GetFrameTimer().Get_dt()); // For now it is the place holder 
					//monoComp.Update((float)LOW_LIMIT); //FrameTimer::deltaTime);
				//monoComp.FixedUpdate();

				if (entity.HasComponent<Component::CGUIEvent>())
				{
					auto& btn = entity.GetComponent<Component::CGUIEvent>();

					if (btn.onClick)
					{
						MonoString* message = mono_string_new(EngineMonoScript::GetAppDomain(), "OnClick");
						monoComp.WaitForMessage(message);
					}
					else if (btn.onReleased) {
						MonoString* message = mono_string_new(EngineMonoScript::GetAppDomain(), "OnRelease");
						monoComp.WaitForMessage(message);
					}
				}

			}
		}

	}

	void SLogic::FixedUpdate() 
	{
		auto entityList = this->GetEntities();
		//static float elasped_time = 0.f;
		//if (elasped_time <	1 / 60.f)
		//{
		//	// entities do not need to (fixed)update.
		//	elasped_time += (float)Global::engineGame->GetFrameTimer().Get_dt(); 
		//	return;
		//}
		//else {
		//	elasped_time -= 1 / 60.f;
		//}

		for (ECS::Entity& entity : entityList)
		{
			if (entity.HasComponent<Component::CMonoScript>())
			{
				auto& monoComp = entity.GetComponent<Component::CMonoScript>();

				if (!monoComp.active)
					continue; // to skip

				monoComp.FixedUpdate((float)LOW_LIMIT);// 1 / 60.f); // For now it is the place holder  

				/*
				if (entity.HasComponent<Component::CGUIEvent>())
				{
					auto& btn = entity.GetComponent<Component::CGUIEvent>();

					if (btn.isClicked)
					{
						MonoString* message = mono_string_new(EngineMonoScript::GetAppDomain(), "OnClick");
						monoComp.WaitForMessage(message);

					}
				}
				*/

			}
		}

	}

	void SLogic::Free() // w game simulation
	{
		// problematic as I assumed all the bheaviour will be attached to an Entity.
		// also I assume that the Behaviour Exits itself when Behaviour is changed.
		auto entityList = this->GetEntities();
		for (ECS::Entity& entity : entityList)
		{
			auto& monoComp = entity.GetComponent<Component::CMonoScript>();
			monoComp.Destroy();  // on second reading, I think it is for when a level end/restarted.

			

		}
	}

	void SLogic::Exit() // w engine
	{
		//auto entityList = this->GetEntities();
		//for (ECS::Entity& entity : entityList)
		//{
		//	// The dynamic allocated stuff is deallocated at Script Engine side.
		//		//auto& monoComp = entity.GetComponent<Component::CMonoScript>();
		//	//monoComp.Destroy(); // destorys the Script, idk if it is suppose to be in MonoScriptEngine.
		//	// I assumes that it is for the instance of MonoObject they want to clear.



		//}

	}




	SLogic::~SLogic() //? 
	{

	}

}// end of namespace




